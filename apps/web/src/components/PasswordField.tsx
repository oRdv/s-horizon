import type { InputHTMLAttributes, KeyboardEvent, PointerEvent } from 'react'
import { useRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function PasswordField({ disabled, ...props }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const ignoreNextClickRef = useRef(false)
  const Icon = isVisible ? EyeOff : Eye

  function handleToggle() {
    setIsVisible((currentValue) => !currentValue)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true })
    })
  }

  function handlePointerToggle(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    ignoreNextClickRef.current = true
    handleToggle()
  }

  function handleClickToggle() {
    if (ignoreNextClickRef.current) {
      ignoreNextClickRef.current = false
      return
    }

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
    <div className="password-field">
      <input {...props} disabled={disabled} ref={inputRef} type={isVisible ? 'text' : 'password'} />
      <button
        aria-label={isVisible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={isVisible}
        className="password-field__toggle"
        disabled={disabled}
        onClick={handleClickToggle}
        onKeyDown={handleKeyToggle}
        onPointerDown={handlePointerToggle}
        type="button"
      >
        <Icon size={17} />
      </button>
    </div>
  )
}
