import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const MAX_IMG = 10 * 1024 * 1024

const ROLE_TAG = {
  admin: 'AI 팀장',
  manager: '담당 선생님',
  instructor: '강사',
}

// 이미지 첨부가 붙은 입력 상자
function CommentBox({ value, onChange, files, setFiles, onSubmit, busy, placeholder, rows = 3 }) {
  const fileRef = useRef(null)

  function add(list) {
    setFiles([...files, ...list.filter((f) => f.type.startsWith('image/') && f.size <= MAX_IMG)])
  }

  function handlePaste(e) {
    const imgs = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
    if (imgs.length === 0) return
    e.preventDefault()
    add(imgs)
  }

  return (
    <div className="form-block">
      <textarea
        className="input"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPaste={handlePaste}
        placeholder={placeholder}
      />

      {files.length > 0 && (
        <div className="chips">
          {files.map((f, i) => (
            <span className="chip" key={i}>
              {f.name || '캡처 이미지'}
              <button
                className="chip-x"
                type="button"
                onClick={() => setFiles(files.filter((_, x) => x !== i))}
                aria-label="첨부 제거"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { add([...e.target.files]); e.target.value = '' }}
      />

      <div className="row">
        <button className="btn btn-sm btn-primary" type="button" disabled={busy} onClick={onSubmit}>
          {busy ? '등록 중…' : '등록'}
        </button>
        <button className="btn btn-sm" type="button" onClick={() => fileRef.current?.click()}>
          이미지 첨부
        </button>
        <span className="note">Ctrl+V로 캡처를 바로 붙여넣을 수 있습니다.</span>
      </div>
    </div>
  )
}

function CommentItem({ node, profile, isStaff, canAccept, images, onReply, onEdit, onDelete, onAccept }) {
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [replyFiles, setReplyFiles] = useState([])
  const [draft, setDraft] = useState(node.body)
  const [busy, setBusy] = useState(false)

  const mine = node.author_id === profile?.id
  const roleTag = ROLE_TAG[node.author?.role]
  const myImages = images.filter((i) => i.comment_id === node.id)

  return (
    <div className={node.parent_id ? 'comment comment-child' : 'comment'}>
      <div className="comment-head">
        <span className="comment-author">{node.author?.nickname ?? '탈퇴한 회원'}</span>
        {roleTag && <span className="tag">{roleTag}</span>}
        {node.is_accepted && <span className="tag tag-done">채택된 답변</span>}
        <span className="muted comment-date">
          {new Date(node.created_at).toLocaleDateString('ko-KR')}
        </span>
      </div>

      {editing ? (
        <div className="form-block">
          <textarea
            className="input"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="row">
            <button
              className="btn btn-sm btn-primary"
              onClick={async () => { await onEdit(node.id, draft); setEditing(false) }}
            >
              저장
            </button>
            <button
              className="btn btn-sm"
              onClick={() => { setDraft(node.body); setEditing(false) }}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="comment-body">{node.body}</p>

          {myImages.length > 0 && (
            <div className="img-list">
              {myImages.map((img) => (
                <a key={img.id} href={img.url} target="_blank" rel="noreferrer">
                  <img className="q-img q-img-sm" src={img.url} alt={img.file_name} />
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {!editing && (
        <div className="row comment-actions">
          {!node.parent_id && (
            <button className="btn btn-sm" onClick={() => setReplying((v) => !v)}>답글</button>
          )}
          {canAccept && !node.parent_id && !node.is_accepted && (
            <button className="btn btn-sm btn-primary" onClick={() => onAccept(node.id)}>채택</button>
          )}
          {mine && <button className="btn btn-sm" onClick={() => setEditing(true)}>수정</button>}
          {(mine || isStaff) && (
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(node.id)}>삭제</button>
          )}
        </div>
      )}

      {replying && (
        <CommentBox
          value={text}
          onChange={setText}
          files={replyFiles}
          setFiles={setReplyFiles}
          busy={busy}
          rows={2}
          placeholder="답글을 입력하세요"
          onSubmit={async () => {
            setBusy(true)
            await onReply(node.id, text, replyFiles)
            setBusy(false)
            setText('')
            setReplyFiles([])
            setReplying(false)
          }}
        />
      )}

      {(node.children ?? []).map((child) => (
        <CommentItem
          key={child.id}
          node={child}
          profile={profile}
          isStaff={isStaff}
          canAccept={false}
          images={images}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          onAccept={onAccept}
        />
      ))}
    </div>
  )
}

export default function QuestionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [question, setQuestion] = useState(null)
  const [comments, setComments] = useState([])
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [newComment, setNewComment] = useState('')
  const [newFiles, setNewFiles] = useState([])

  const isStaff = profile?.role === 'manager' || profile?.role === 'admin'
  const mine = question?.author_id === profile?.id
  const canAccept = mine || isStaff || profile?.role === 'instructor'

  const load = useCallback(async () => {
    setLoading(true)

    const [q, c, mem] = await Promise.all([
      supabase
        .from('questions')
        .select('*, module:modules(order_no, name)')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('comments').select('*').eq('question_id', id).order('created_at'),
      supabase.from('member_public').select('id, nickname, role'),
    ])

    if (q.error) setError(q.error.message)

    const memberMap = new Map((mem.data ?? []).map((m) => [m.id, m]))

    if (q.data) {
      setQuestion({ ...q.data, author: memberMap.get(q.data.author_id) })
      setTitle(q.data.title)
      setBody(q.data.body)
    }

    const rows = (c.data ?? []).map((r) => ({ ...r, author: memberMap.get(r.author_id) }))
    const roots = rows.filter((r) => !r.parent_id)
    roots.forEach((r) => { r.children = rows.filter((x) => x.parent_id === r.id) })
    setComments(roots)

    // 질문 + 모든 댓글의 이미지
    const commentIds = rows.map((r) => r.id)
    let filter = `question_id.eq.${id}`
    if (commentIds.length > 0) filter += `,comment_id.in.(${commentIds.join(',')})`

    const { data: imgRows } = await supabase
      .from('question_images')
      .select('id, question_id, comment_id, storage_path, file_name')
      .or(filter)

    const list = imgRows ?? []

    if (list.length > 0) {
      const { data: signed } = await supabase.storage
        .from('question-images')
        .createSignedUrls(list.map((i) => i.storage_path), 3600)

      const urlMap = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
      setImages(list.map((i) => ({ ...i, url: urlMap.get(i.storage_path) })))
    } else {
      setImages([])
    }

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    supabase.rpc('increment_view', { p_question_id: id })
  }, [id])

  async function uploadImages(files, { questionId = null, commentId = null }) {
    for (const file of files) {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `${id}/${crypto.randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('question-images')
        .upload(path, file)

      if (upErr) {
        setError(`이미지 업로드 실패: ${upErr.message}`)
        return
      }

      await supabase.from('question_images').insert({
        question_id: questionId,
        comment_id: commentId,
        author_id: profile.id,
        storage_path: path,
        file_name: file.name || '캡처.png',
        size_bytes: file.size,
      })
    }
  }

  async function saveQuestion() {
    const { error } = await supabase
      .from('questions')
      .update({ title: title.trim(), body: body.trim() })
      .eq('id', id)

    if (error) {
      setError(`수정 실패: ${error.message}`)
      return
    }
    setEditing(false)
    await load()
  }

  async function deleteQuestion() {
    if (!confirm('이 질문을 삭제할까요?\n달린 댓글과 이미지도 함께 사라집니다.')) return

    const { error } = await supabase.from('questions').delete().eq('id', id)

    if (error) {
      setError(`삭제 실패: ${error.message}`)
      return
    }
    navigate('/questions')
  }

  async function toggleResolved() {
    const { error } = await supabase.rpc('toggle_resolved', {
      p_question_id: id,
      p_value: !question.is_resolved,
    })

    if (error) setError(`상태 변경 실패: ${error.message}`)
    await load()
  }

  async function addComment(parentId, text, files = []) {
    if (!text.trim() && files.length === 0) return

    const { data: created, error } = await supabase
      .from('comments')
      .insert({
        question_id: id,
        parent_id: parentId,
        author_id: profile.id,
        body: text.trim() || '(이미지)',
      })
      .select('id')
      .single()

    if (error) {
      setError(`댓글 등록 실패: ${error.message}`)
      return
    }

    if (files.length > 0) {
      await uploadImages(files, { commentId: created.id })
    }
    await load()
  }

  async function editComment(commentId, text) {
    const { error } = await supabase
      .from('comments')
      .update({ body: text.trim() })
      .eq('id', commentId)

    if (error) setError(`댓글 수정 실패: ${error.message}`)
    await load()
  }

  async function deleteComment(commentId) {
    if (!confirm('댓글을 삭제할까요?')) return

    const { error } = await supabase.from('comments').delete().eq('id', commentId)

    if (error) setError(`댓글 삭제 실패: ${error.message}`)
    await load()
  }

  async function accept(commentId) {
    const { error } = await supabase.rpc('accept_answer', { p_comment_id: commentId })

    if (error) setError(`채택 실패: ${error.message}`)
    await load()
  }

  if (loading) return <p className="page-sub">불러오는 중…</p>

  if (!question) {
    return (
      <div className="page-head">
        <h1 className="page-title">질문을 찾을 수 없습니다</h1>
        <p className="page-sub">삭제되었거나 접근 권한이 없습니다.</p>
      </div>
    )
  }

  const questionImages = images.filter((i) => i.question_id)

  return (
    <>
      <button className="btn-back" type="button" onClick={() => navigate('/questions')}>
        ← 목록
      </button>

      <div className="page-head">
        <span className="eyebrow">
          {question.module?.order_no}모듈 · {question.module?.name}
        </span>

        {editing ? (
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
        ) : (
          <div className="title-row">
            <h1 className="page-title">{question.title}</h1>
            <span className={question.is_resolved ? 'badge badge-done' : 'badge badge-act'}>
              {question.is_resolved ? '해결' : '미해결'}
            </span>
          </div>
        )}

        <p className="page-sub">
          {question.author?.nickname ?? '탈퇴한 회원'}
          {' · '}{new Date(question.created_at).toLocaleDateString('ko-KR')}
          {' · '}조회 {question.view_count}
        </p>
      </div>

      {(mine || isStaff) && !editing && (
        <div className="quick">
          {mine && <button className="btn btn-sm" onClick={() => setEditing(true)}>수정</button>}
          {canAccept && (
            <button className="btn btn-sm" onClick={toggleResolved}>
              {question.is_resolved ? '미해결로 되돌리기' : '해결됨으로 표시'}
            </button>
          )}
          <button className="btn btn-sm btn-danger" onClick={deleteQuestion}>삭제</button>
        </div>
      )}

      <div className="tile">
        {editing ? (
          <div className="form-block">
            <textarea
              className="input"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="row">
              <button className="btn btn-sm btn-primary" onClick={saveQuestion}>저장</button>
              <button className="btn btn-sm" onClick={() => setEditing(false)}>취소</button>
            </div>
          </div>
        ) : (
          <>
            <p className="question-body">{question.body}</p>

            {questionImages.length > 0 && (
              <div className="img-list">
                {questionImages.map((img) => (
                  <a key={img.id} href={img.url} target="_blank" rel="noreferrer">
                    <img className="q-img" src={img.url} alt={img.file_name} />
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {error && <p className="alert">{error}</p>}

      <h2 className="section-title">댓글 {comments.length}</h2>

      <div className="tile">
        <CommentBox
          value={newComment}
          onChange={setNewComment}
          files={newFiles}
          setFiles={setNewFiles}
          busy={busy}
          placeholder="댓글을 입력하세요"
          onSubmit={async () => {
            setBusy(true)
            await addComment(null, newComment, newFiles)
            setBusy(false)
            setNewComment('')
            setNewFiles([])
          }}
        />
      </div>

      <div className="stack-list">
        {comments.map((c) => (
          <div className="tile" key={c.id}>
            <CommentItem
              node={c}
              profile={profile}
              isStaff={isStaff}
              canAccept={canAccept}
              images={images}
              onReply={addComment}
              onEdit={editComment}
              onDelete={deleteComment}
              onAccept={accept}
            />
          </div>
        ))}
      </div>
    </>
  )
}