<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->api(prepend: [
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);

        $middleware->alias([
            'auth.jwt' => \App\Http\Middleware\AuthenticateWithJwt::class,
            'permission' => \App\Http\Middleware\EnsureUserHasPermission::class,
            'role' => \App\Http\Middleware\EnsureUserHasRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->render(function (\Illuminate\Database\QueryException $exception, \Illuminate\Http\Request $request) {
            if (! $request->expectsJson()) {
                return null;
            }

            $connection = config('database.default');
            $database = config("database.connections.{$connection}.database");
            $host = config("database.connections.{$connection}.host");
            $port = config("database.connections.{$connection}.port");
            $username = (string) config("database.connections.{$connection}.username");

            \Illuminate\Support\Facades\Log::error('database.query_failed', [
                'connection' => $connection,
                'host' => $host,
                'port' => $port,
                'database' => $database,
                'username' => $username === '' ? null : substr($username, 0, 3).'***',
                'sqlstate' => $exception->errorInfo[0] ?? null,
                'driver_code' => $exception->errorInfo[1] ?? null,
                'path' => $request->path(),
            ]);

            return response()->json([
                'message' => 'Nao foi possivel conectar ao banco de dados da Horizon Boost. Verifique as variaveis DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME e DB_PASSWORD.',
            ], 503);
        });

        $exceptions->render(function (\Symfony\Component\Mailer\Exception\TransportExceptionInterface $exception, \Illuminate\Http\Request $request) {
            if (! $request->expectsJson()) {
                return null;
            }

            \Illuminate\Support\Facades\Log::error('mail.transport_failed', [
                'mailer' => config('mail.default'),
                'host' => config('mail.mailers.smtp.host'),
                'port' => config('mail.mailers.smtp.port'),
                'scheme' => config('mail.mailers.smtp.scheme'),
                'username_configured' => filled(config('mail.mailers.smtp.username')),
                'from_address' => config('mail.from.address'),
                'path' => $request->path(),
            ]);

            return response()->json([
                'message' => 'Nao conseguimos enviar o e-mail agora. Verifique a configuracao SMTP da Horizon Boost.',
            ], 503);
        });
    })->create();
