import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const ROLE = {
  admin: 'AI 팀장',
  manager: '담당 선생님',
  instructor: '강사',
  student: '교육생',
}

const GREETING = {
  admin: '사이트 전체를 관리할 수 있습니다.',
  manager: '교육생 관리와 공지 등록을 담당합니다.',
  instructor: '수업 자료를 올리고 질문에 답변해 주세요.',
  student: '궁금한 점은 질문 게시판에 남겨주세요.',
}

const TILES = [
  {
    key: 'materials',
    title: '수업 자료',
    to: '/materials',
    action: { admin: '관리', manager: '관리', instructor: '업로드', student: '열람' },
    desc: {
      admin: '전체 자료를 관리하고 정리합니다.',
      manager: '전체 자료를 관리하고 정리합니다.',
      instructor: '강의 자료를 올리고 수정합니다.',
      student: '강의에서 쓴 자료를 내려받습니다.',
    },
  },
  {
    key: 'questions',
    title: '질문 게시판',
    to: '/questions',
    action: { admin: '관리', manager: '관리', instructor: '답변', student: '질문' },
    desc: {
      admin: '전체 질문을 확인하고 관리합니다.',
      manager: '전체 질문을 확인하고 관리합니다.',
      instructor: '교육생 질문에 답변하고 채택합니다.',
      student: '과제나 에러에 대해 묻고 답합니다.',
    },
  },
  {
    key: 'jobs',
    title: '취업 정보',
    to: '/jobs',
    action: { admin: '등록', manager: '등록', instructor: '열람', student: '열람' },
    desc: {
      admin: '채용공고를 등록하고 관리합니다.',
      manager: '채용공고를 등록하고 관리합니다.',
      instructor: '채용공고와 자소서 후기를 봅니다.',
      student: '채용공고와 자소서 후기를 봅니다.',
    },
  },
  {
    key: 'events',
    title: '일정',
    to: '/events',
    action: { admin: '등록', manager: '등록', instructor: '열람', student: '열람' },
    desc: {
      admin: '휴무일과 행사 일정을 등록합니다.',
      manager: '휴무일과 행사 일정을 등록합니다.',
      instructor: '휴무일과 행사 일정을 확인합니다.',
      student: '휴무일과 행사 일정을 확인합니다.',
    },
  },
]

export default function Home() {
  const { profile } = useAuth()
  const role = profile?.role ?? 'student'

  const belong = profile?.cohort
    ? `${profile.cohort.program?.name ?? ''} ${profile.cohort.name}`.trim()
    : '소속 미지정'

  const isStaff = role === 'manager' || role === 'admin'

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{ROLE[role]}</span>
        <h1 className="page-title">{profile?.name}님, 반갑습니다</h1>
        <p className="page-sub">{belong} · {GREETING[role]}</p>
      </div>

      

      <div className="card-grid">
        {TILES.map((t) => {
          const body = (
            <>
              <div className="tile-head">
                <h2 className="tile-title">{t.title}</h2>
                <span className="badge badge-act">{t.action[role]}</span>
              </div>
              <p className="tile-desc">{t.desc[role]}</p>
              {!t.to && <p className="tile-foot">준비 중</p>}
            </>
          )

          return t.to ? (
            <Link className="tile tile-link" key={t.key} to={t.to}>
              {body}
            </Link>
          ) : (
            <div className="tile tile-off" key={t.key}>
              {body}
            </div>
          )
        })}
      </div>
    </>
  )
}