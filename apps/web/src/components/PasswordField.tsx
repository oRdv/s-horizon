import type { InputHTMLAttributes } from 'react'
import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>

export function PasswordField({ disabled, ...props }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)
  const Icon = isVisible ? EyeOff : Eye

  return (
    <div className="password-field">
      <input {...props} disabled={disabled} type={isVisible ? 'text' : 'password'} />
      <button
        aria-label={isVisible ? 'Ocultar senha' : 'Mostrar senha'}
        className="password-field__toggle"
        disabled={disabled}
        onClick={() => setIsVisible((currentValue) => !currentValue)}
        type="button"
      >
        <Icon size={17} />
      </button>
    </div>
  )
}
