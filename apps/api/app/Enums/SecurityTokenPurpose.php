<?php

namespace App\Enums;

enum SecurityTokenPurpose: string
{
    case EmailVerification = 'email_verification';
    case ProfileChange = 'profile_change';
    case PasswordChange = 'password_change';
    case PasswordReset = 'password_reset';
    case TwoFactorSetup = 'two_factor_setup';
    case TwoFactorLogin = 'two_factor_login';
}
