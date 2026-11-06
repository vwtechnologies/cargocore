<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PersonBankAccount extends Record
{
    public function person(): BelongsTo
    {
        return $this->belongsTo(Person::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(BankBranch::class, 'bank_branch_id');
    }
}
