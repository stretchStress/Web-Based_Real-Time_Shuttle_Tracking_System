<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Driver;
use App\Models\Client;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'first_name'   => 'required|string|max:255',
            'last_name'    => 'required|string|max:255',
            'email'        => 'nullable|string|email|unique:users,email',
            'password'     => 'required|string|min:6|confirmed',
            'role'         => 'required|in:admin,driver,client',

            'license'      => 'required_if:role,driver|string|max:50|unique:drivers,license',
            'company_id'   => 'required_if:role,client|exists:companies,id',
        ]);

        $user = User::create([
            'first_name' => $validated['first_name'],
            'last_name'  => $validated['last_name'],
            'email'      => $validated['email'] ?? null,
            'password'   => Hash::make($validated['password']),
            'role'       => $validated['role'],
        ]);

        if ($user->role === 'driver') {
            Driver::create([
                'user_id'    => $user->id,
                'first_name' => $validated['first_name'],
                'last_name'  => $validated['last_name'],
                'license'    => $validated['license'],
                'email'      => $validated['email'] ?? null,
            ]);
        }

        if ($user->role === 'client') {
            Client::create([
                'user_id'    => $user->id,
                'company_id' => $validated['company_id'],
                'first_name' => $validated['first_name'],
                'last_name'  => $validated['last_name'],
                'email'      => $validated['email'] ?? null,
            ]);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'user'  => $user->load($user->role),
            'token' => $token,
        ], 201);
    }

    public function login(Request $request)
    {
        $validated = $request->validate([
            'id'       => 'required|integer',
            'password' => 'required|string',
        ]);

        $user = User::find($validated['id']);

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'id' => ['The provided credentials are incorrect.'],
            ]);
        }

        // For client users, enforce that their company is active before issuing a token
        if ($user->role === 'client') {
            $client = Client::with('company')->where('user_id', $user->id)->first();

            if ($client && $client->company) {
                $companyStatus = $client->company->status;

                if ($companyStatus && strtolower($companyStatus) !== 'active') {
                    $statusLower = strtolower($companyStatus);

                    $message = $statusLower === 'inactive'
                        ? "Your company's contract with the shuttle service is not active (renewed). Please contact your company administrator or HR."
                        : "Your company's contract with the shuttle service is terminated. Shuttle Service will no longer be providing services to your company.";

                    return response()->json([
                        'message'        => $message,
                        'company_status' => $companyStatus,
                    ], 403);
                }
            }
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        $driver_id = null;
        if ($user->role === 'driver') {
            $driver = $user->driver()->first();
            $driver_id = $driver ? $driver->id : null;
        }

        return response()->json([
            'user'         => $user,
            'token'        => $token,
            'driver_id'    => $driver_id,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }

    public function resetPassword(Request $request)
    {
        $validated = $request->validate([
            'id'       => 'required|integer',
            'password' => 'required|string|min:8',
        ]);

        if (!preg_match('/[A-Z]/', $validated['password']) || !preg_match('/[0-9]/', $validated['password'])) {
            throw ValidationException::withMessages([
                'password' => ['Password must include at least one uppercase letter and one number.'],
            ]);
        }

        $user = User::find($validated['id']);
        if (!$user) throw ValidationException::withMessages(['id' => ['User not found.']]);
        if ($user->role !== 'driver')
            throw ValidationException::withMessages(['id' => ['Only drivers can reset passwords here.']]);

        $user->update(['password' => Hash::make($validated['password'])]);

        return response()->json([
            'success' => true,
            'message' => 'Password updated successfully. You can now login with your new password.',
        ]);
    }
}
