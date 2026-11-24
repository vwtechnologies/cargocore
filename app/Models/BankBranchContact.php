<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A titled phone number for one bank branch, such as Landline 1, Fax or Branch Manager. */
class BankBranchContact extends Record
{
    protected $hidden = ['primary_guard', 'deleted_at'];

    protected function casts(): array
    {
        return [...parent::casts(), 'is_primary' => 'boolean'];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(BankBranch::class, 'bank_branch_id');
    }
}
