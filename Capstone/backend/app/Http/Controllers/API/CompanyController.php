<?php

namespace App\Http\Controllers\API;

use App\Models\Company;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;

class CompanyController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        return response()->json(Company::with('clients')->get());
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'contact_email' => 'nullable|email|max:255',
            'contact_number' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+()\-\s\.]{7,20}$/'],
            'address' => 'nullable|string|max:500',
            'city' => 'nullable|string|max:100',
            'province' => 'nullable|string|max:100',
            'postal_code' => ['nullable', 'string', 'max:20'],
            'contract_start' => 'nullable|date',
            'contract_end' => [
                'nullable',
                'date',
                function ($attribute, $value, $fail) use ($request) {
                    if ($value && $request->contract_start && $value < $request->contract_start) {
                        $fail('Contract end date must be after or equal to contract start date.');
                    }
                },
            ],
            'status' => 'in:active,inactive,terminated',
        ]);

        $company = Company::create($validated);
        $company = Company::with('clients')->find($company->id);

        return response()->json([
            'message' => 'Company created successfully',
            'data' => $company,
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $company = Company::withTrashed()->with('clients')->findOrFail($id);
        return response()->json($company);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $company = Company::withTrashed()->findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'contact_email' => 'nullable|email|max:255',
            'contact_number' => ['nullable', 'string', 'max:20', 'regex:/^[0-9+()\-\s\.]{7,20}$/'],
            'address' => 'nullable|string|max:500',
            'city' => 'nullable|string|max:100',
            'province' => 'nullable|string|max:100',
            'postal_code' => ['nullable', 'string', 'max:20'],
            'contract_start' => 'nullable|date',
            'contract_end' => [
                'nullable',
                'date',
                function ($attribute, $value, $fail) use ($request, $company) {
                    $startDate = $request->contract_start ?? $company->contract_start;
                    if ($value && $startDate && $value < $startDate) {
                        $fail('Contract end date must be after or equal to contract start date.');
                    }
                },
            ],
            'status' => 'in:active,inactive,terminated',
        ]);

        $company->update($validated);
        $fresh = Company::withTrashed()->with('clients')->find($company->id);

        return response()->json([
            'message' => 'Company updated successfully',
            'data' => $fresh,
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $company = Company::findOrFail($id);
        $company->delete();

        return response()->json(['message' => 'Company deleted successfully']);
    }

    /**
     * Restore a soft-deleted company.
     */
    public function restore($id)
    {
        $company = Company::withTrashed()->findOrFail($id);
        $company->restore();

        return response()->json(['message' => 'Company restored successfully']);
    }

    /**
     * Renew/extend a company contract and set status to active.
     */
    public function renew(Request $request, $id)
    {
        $company = Company::withTrashed()->findOrFail($id);

        $validated = $request->validate([
            'contract_start' => 'required|date',
            'contract_end' => [
                'required',
                'date',
                function ($attribute, $value, $fail) use ($request) {
                    if ($value < $request->contract_start) {
                        $fail('Contract end date must be after or equal to contract start date.');
                    }
                },
            ],
        ]);

        $company->update([
            'contract_start' => $validated['contract_start'],
            'contract_end' => $validated['contract_end'],
            'status' => 'active',
        ]);

        $fresh = Company::with('clients')->find($company->id);

        return response()->json([
            'message' => 'Company contract renewed and activated successfully',
            'data' => $fresh,
        ]);
    }
}
