<?php

namespace App\Modules\Shared;

class UppercaseData
{
    public static function record(string $entity, array $values): array
    {
        foreach (EntityRegistry::get($entity)['fields'] as $key => $field) {
            if (in_array($field['type'] ?? 'text', ['text', 'textarea', 'combobox', 'list', 'email', 'url'], true) && array_key_exists($key, $values)) {
                $values[$key] = is_array($values[$key]) ? array_map(self::text(...), $values[$key]) : self::text($values[$key]);
            }
        }

        return $values;
    }

    public static function text(mixed $value): mixed
    {
        return is_string($value) ? mb_strtoupper($value, 'UTF-8') : $value;
    }
}
