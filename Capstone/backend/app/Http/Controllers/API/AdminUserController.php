<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Driver;
use App\Models\Client;
use App\Models\Company;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class AdminUserController extends Controller
{
    // List all users based on role
    public function index($type)
    {
        if ($type === 'driver') {
            return response()->json(
                Driver::whereHas('user', fn($q) => $q->whereNull('deleted_at'))
                    ->with('user')
                    ->get()
            );
        }

        if ($type === 'client') {
            return response()->json(
                Client::whereHas('user', fn($q) => $q->whereNull('deleted_at'))
                    ->with(['user', 'company'])
                    ->get()
            );
        }

        return response()->json([], 404);
    }

    // Create Driver or Client (global creation)
    public function store(Request $request, $type)
    {
        $validated = $request->validate([
            'first_name'     => 'required|string|max:255',
            'last_name'      => 'required|string|max:255',
            'email'          => 'nullable|email|unique:users,email',
            'password'       => 'required|string|min:6',

            'cellphone_num'  => $type === 'driver'
                ? 'required|string|max:50|unique:drivers,cellphone_num'
                : 'nullable',

            'company_id'     => $type === 'client' ? 'required|exists:companies,id' : 'nullable',
        ]);

        $user = User::create([
            'first_name' => $validated['first_name'],
            'last_name'  => $validated['last_name'],
            'email'      => $validated['email'] ?? null,
            'password'   => Hash::make($validated['password']),
            'role'       => $type,
        ]);

        if ($type === 'driver') {
            Driver::create([
                'user_id'       => $user->id,
                'first_name'    => $validated['first_name'],
                'last_name'     => $validated['last_name'],
                'cellphone_num' => $validated['cellphone_num'],
                'email'         => $validated['email'] ?? null,
            ]);
        }

        if ($type === 'client') {
            Client::create([
                'user_id'    => $user->id,
                'company_id' => $validated['company_id'],
                'first_name' => $validated['first_name'],
                'last_name'  => $validated['last_name'],
                'email'      => $validated['email'] ?? null,
            ]);
        }

        return response()->json([
            'message' => 'User created successfully',
            'user'    => $user->load($type),
        ], 201);
    }

    // Update Driver or Client
    public function update(Request $request, $type, $id)
    {
        $user = User::findOrFail($id);

        if ($type === 'driver') $user->load('driver');
        if ($type === 'client') $user->load('client');

        $validated = $request->validate([
            'first_name'     => 'sometimes|required|string|max:255',
            'last_name'      => 'sometimes|required|string|max:255',
            'email'          => 'nullable|email|unique:users,email,' . $user->id,
            'password'       => 'nullable|string|min:6',

            'cellphone_num'  => $type === 'driver'
                ? 'sometimes|required|string|max:50|unique:drivers,cellphone_num,' . ($user->driver->id ?? 'NULL')
                : 'nullable',

            'company_id'     => $type === 'client' ? 'sometimes|required|exists:companies,id' : 'nullable',
        ]);

        // Update user
        $user->update([
            'first_name' => $validated['first_name'] ?? $user->first_name,
            'last_name'  => $validated['last_name'] ?? $user->last_name,
            'email'      => $validated['email'] ?? $user->email,
            'password'   => isset($validated['password'])
                ? Hash::make($validated['password'])
                : $user->password,
        ]);

        // Update related
        if ($type === 'driver' && $user->driver) {
            $user->driver->update([
                'first_name'    => $validated['first_name'] ?? $user->driver->first_name,
                'last_name'     => $validated['last_name'] ?? $user->driver->last_name,
                'cellphone_num' => $validated['cellphone_num'] ?? $user->driver->cellphone_num,
                'email'         => $validated['email'] ?? $user->driver->email,
            ]);
        }

        if ($type === 'client' && $user->client) {
            $user->client->update([
                'first_name' => $validated['first_name'] ?? $user->client->first_name,
                'last_name'  => $validated['last_name'] ?? $user->client->last_name,
                'email'      => $validated['email'] ?? $user->client->email,
                'company_id' => $validated['company_id'] ?? $user->client->company_id,
            ]);
        }

        return response()->json([
            'message' => 'User updated successfully',
            'user'    => $user->load($type),
        ]);
    }

    // Delete user
    public function destroy($type, $id)
    {
        $user = User::where('id', $id)->where('role', $type)->firstOrFail();
        $user->delete();
        return response()->json(['message' => ucfirst($type) . ' deleted successfully']);
    }

    // Restore user
    public function restore($id)
    {
        $user = User::withTrashed()->findOrFail($id);
        $user->restore();
        return response()->json(['message' => 'User restored successfully']);
    }

    // Drivers list (for dropdowns)
    public function drivers()
    {
        return User::where('role', 'driver')
            ->get(['id', 'first_name', 'last_name', 'email'])
            ->map(fn($u) => [
                'id'    => $u->id,
                'name'  => $u->first_name . ' ' . $u->last_name,
                'email' => $u->email,
            ]);
    }

    // Filter by company
    public function indexByCompany(Request $request, $company_id)
    {
        $user_type = $request->query('user_type', 'driver');

        if ($user_type === 'driver') {
            return response()->json(
                Driver::whereHas('user', fn($q) => $q->whereNull('deleted_at'))
                    ->with('user')
                    ->get()
            );
        }

        if ($user_type === 'client') {
            return response()->json(
                Client::where('company_id', $company_id)
                    ->whereHas('user', fn($q) => $q->whereNull('deleted_at'))
                    ->with(['user', 'company'])
                    ->get()
            );
        }

        return response()->json([], 404);
    }

    // Create client under a specific company
    public function storeByCompany(Request $request, $company_id, $type)
    {
        if ($type !== 'client') {
            return response()->json([
                'message' => 'Drivers must be created globally, not scoped to a company.',
                'error'   => 'Invalid user type',
            ], 400);
        }

        $validated = $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name'  => 'required|string|max:255',
            'email'      => 'nullable|email|unique:users,email',
            'password'   => 'required|string|min:6',
        ]);

        $user = User::create([
            'first_name' => $validated['first_name'],
            'last_name'  => $validated['last_name'],
            'email'      => $validated['email'] ?? null,
            'password'   => Hash::make($validated['password']),
            'role'       => 'client',
        ]);

        Client::create([
            'user_id'    => $user->id,
            'company_id' => $company_id,
            'first_name' => $validated['first_name'],
            'last_name'  => $validated['last_name'],
            'email'      => $validated['email'] ?? null,
        ]);

        return response()->json([
            'message' => 'Client created successfully for company',
            'user'    => $user->load('client'),
        ], 201);
    }
}
