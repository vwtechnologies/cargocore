<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PersonBankAccount extends Record
{
    /** @var list<string> */
    public const CATEGORIES = ['is_cheque', 'is_beneficiary', 'is_employee', 'is_company', 'is_our_account', 'is_other'];

    protected function casts(): array
    {
        return [...parent::casts(), ...array_fill_keys(self::CATEGORIES, 'boolean'), 'opening_balance_date' => 'date:Y-m-d'];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public function companyAddress(): BelongsTo
    {
        return $this->belongsTo(CompanyAddress::class);
    }

    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(BankBranch::class, 'bank_branch_id');
    }
}
