import { type ReactNode } from 'react'
import { useReveal } from '../hooks/useReveal'

export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: 'div' | 'section' | 'figure'
}) {
  const { ref, revealed } = useReveal<HTMLDivElement>()

  return (
    <Tag
      ref={ref as never}
      className={`
        transition-[opacity,transform] duration-700 ease-out will-change-transform
        ${revealed ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}
        ${className}
      `}
      style={{ transitionDelay: revealed ? `${delay}ms` : '0ms' }}
    >
      {children}
    </Tag>
  )
}