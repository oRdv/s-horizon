<?php

return [
    'card_credit_fee_percent' => env('PAYMENT_CARD_CREDIT_FEE_PERCENT', '0'),
    'card_debit_fee_percent' => env('PAYMENT_CARD_DEBIT_FEE_PERCENT', '0'),
    'pix_discount_percent' => env('PAYMENT_PIX_DISCOUNT_PERCENT', '10'),
    'max_credit_installments' => (int) env('PAYMENT_MAX_CREDIT_INSTALLMENTS', 2),
    'frontend_url' => env('FRONTEND_URL', env('VITE_APP_URL', 'http://localhost:5173')),
    'backend_url' => env('BACKEND_URL', env('APP_URL', 'http://localhost:8000')),
    'test_mode' => env('PAYMENT_TEST_MODE', false),
    'force_next_pix_amount_cents' => env('PAYMENT_FORCE_NEXT_PIX_AMOUNT_CENTS'),
];
