<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubCompany extends Record
{
    protected function casts(): array
    {
        return array_merge(parent::casts(), ['contact_numbers' => 'array', 'fax_numbers' => 'array', 'mobile_numbers' => 'array']);
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
