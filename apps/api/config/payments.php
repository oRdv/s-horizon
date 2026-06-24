<?php

return [
    'card_credit_fee_percent' => env('PAYMENT_CARD_CREDIT_FEE_PERCENT', '0'),
    'card_debit_fee_percent' => env('PAYMENT_CARD_DEBIT_FEE_PERCENT', '0'),
    'pix_discount_percent' => env('PAYMENT_PIX_DISCOUNT_PERCENT', '10'),
    'max_credit_installments' => (int) env('PAYMENT_MAX_CREDIT_INSTALLMENTS', 2),
    'booster_payout_percent' => env('BOOSTER_PAYOUT_PERCENT', '70'),
    'frontend_url' => env('FRONTEND_URL', env('VITE_APP_URL', 'https://horizonboost.com.br')),
    'backend_url' => env('BACKEND_URL', env('APP_URL', 'https://api.horizonboost.com.br')),
];
