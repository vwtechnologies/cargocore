<?php

namespace App\Models;

class BusinessType extends Record
{
    protected function casts(): array
    {
        return array_merge(parent::casts(), ['is_employee' => 'boolean']);
    }
}
