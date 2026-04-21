<?php

namespace App\Enums;

enum Permission: string
{
    case ViewAllUsers = 'users.view_all';
    case ViewUsersByRole = 'users.view_by_role';
    case ManageUsers = 'users.manage';
    case ActivateUsers = 'users.activate';
    case ManageStaffPermissions = 'staff.permissions.manage';
    case ViewBoosters = 'boosters.view';
    case CreateBoosters = 'boosters.create';
    case ViewBoosterProgress = 'boosters.progress.view';
    case ViewOperationOrders = 'orders.operation.view';
    case ViewCustomerPurchases = 'orders.customer_purchases.view';
    case ViewTournamentRegistrations = 'tournaments.view_all';
    case CreateCustomerPayments = 'payments.customer.create';
    case ViewPaymentHistory = 'payments.history.view';
    case ViewBoosterPayments = 'finance.booster_payments.view';
    case ViewFinancialControl = 'finance.control.view';
    case ManageWithdrawals = 'finance.withdrawals.manage';
    case RequestWithdrawals = 'finance.withdrawals.request';
    case ViewGlobalGoals = 'goals.global.view';
    case ViewBoosterGoals = 'goals.booster.view';
    case ManageOwnProfile = 'profile.manage';
    case ManageOwnSecurity = 'account.security.manage';

    public function label(): string
    {
        return match ($this) {
            self::ViewAllUsers => 'Visualizar todos os usuários',
            self::ViewUsersByRole => 'Visualizar usuários por perfil',
            self::ManageUsers => 'Cadastrar e editar usuários',
            self::ActivateUsers => 'Ativar e desativar usuários',
            self::ManageStaffPermissions => 'Gerenciar permissões de staffs',
            self::ViewBoosters => 'Visualizar boosters',
            self::CreateBoosters => 'Cadastrar boosters',
            self::ViewBoosterProgress => 'Visualizar progresso dos boosters',
            self::ViewOperationOrders => 'Acompanhar pedidos da operação',
            self::ViewCustomerPurchases => 'Visualizar compras de clientes',
            self::ViewTournamentRegistrations => 'Visualizar inscriÃ§Ãµes de campeonatos',
            self::CreateCustomerPayments => 'Criar pagamentos de clientes',
            self::ViewPaymentHistory => 'Visualizar histórico financeiro',
            self::ViewBoosterPayments => 'Acessar pagamentos de boosters',
            self::ViewFinancialControl => 'Acessar controle financeiro',
            self::ManageWithdrawals => 'Aprovar ou rejeitar retiradas',
            self::RequestWithdrawals => 'Solicitar retirada',
            self::ViewGlobalGoals => 'Visualizar metas globais',
            self::ViewBoosterGoals => 'Visualizar metas individuais dos boosters',
            self::ManageOwnProfile => 'Gerenciar próprio perfil',
            self::ManageOwnSecurity => 'Gerenciar segurança da própria conta',
        };
    }
}
