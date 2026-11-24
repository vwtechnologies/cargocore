<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanyContact extends Record
{
    protected $hidden = ['primary_guard', 'deleted_at'];

    protected function casts(): array
    {
        return [...parent::casts(), 'is_primary' => 'boolean'];
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
