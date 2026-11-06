<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PersonClassification extends Record
{
    protected function casts(): array
    {
        return array_merge(parent::casts(), ['opening_balance' => 'decimal:2']);
    }

    public function association(): BelongsTo
    {
        return $this->belongsTo(PersonCompany::class, 'person_company_id');
    }

    public function businessType(): BelongsTo
    {
        return $this->belongsTo(BusinessType::class);
    }
}
