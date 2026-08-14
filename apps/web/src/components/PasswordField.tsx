import type { InputHTMLAttributes, KeyboardEvent } from 'react'
import { useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  isAdmin?: boolean
}

export function PasswordField({ disabled, isAdmin, ...props }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const Icon = isVisible ? EyeOff : Eye

  function handleToggle() {
    setIsVisible((currentValue) => !currentValue)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
    })
  }

  function handleClickToggle() {
    handleToggle()
  }

  function handleKeyToggle(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return
    }

    event.preventDefault()
    handleToggle()
  }

  return (
    <div className={`password-field ${isAdmin ? 'password-field--admin' : ''}`}>
      <input {...props} disabled={disabled} ref={inputRef} type={isVisible ? 'text' : 'password'} />
      <button
        aria-label={isVisible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={isVisible}
        className="password-field__toggle"
        disabled={disabled}
        onClick={handleClickToggle}
        onKeyDown={handleKeyToggle}
        type="button"
      >
        <Icon size={17} />
      </button>
    </div>
  )
}
