<?php

namespace App\Http\Middleware;

use App\Exceptions\InvalidTokenException;
use App\Models\User;
use App\Services\Auth\JwtService;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateWithJwt
{
    public function __construct(
        private readonly JwtService $jwtService,
    ) {
    }

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! is_string($token) || trim($token) === '') {
            return response()->json([
                'message' => 'O access token não foi informado.',
            ], 401);
        }

        try {
            $decodedToken = $this->jwtService->decodeAccessToken($token);
        } catch (InvalidTokenException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 401);
        }

        /** @var User|null $user */
        $user = User::query()->find($decodedToken->subject);

        if (! $user) {
            return response()->json([
                'message' => 'O usuário informado no token não foi encontrado.',
            ], 401);
        }

        $request->setUserResolver(fn (): User => $user);
        Auth::setUser($user);

        return $next($request);
    }
}
