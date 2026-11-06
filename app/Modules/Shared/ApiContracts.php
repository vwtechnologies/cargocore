<?php

namespace App\Modules\Shared;

/** Supplemental endpoint schemas and their generated TypeScript representation. */
class ApiContracts
{
    public static function supplement(array &$paths, array &$schemas): void
    {
        $string = ['type' => 'string'];
        $integer = ['type' => 'integer'];
        $boolean = ['type' => 'boolean'];
        $nullable = ['type' => ['string', 'null']];
        $ref = fn (string $name): array => ['$ref' => '#/components/schemas/'.$name];
        $array = fn (array $items): array => ['type' => 'array', 'items' => $items];
        $object = fn (array $properties, array $required = []): array => ['type' => 'object', 'properties' => $properties, 'required' => $required];
        $ids = $array($integer);
        $schemas['Navigation'] = $object(array_fill_keys(['first', 'previous', 'next', 'last'], ['type' => ['integer', 'null']]) + ['position' => $integer, 'total' => $integer], ['first', 'previous', 'next', 'last', 'position', 'total']);
        $schemas['Permission'] = $object(['id' => $integer, 'name' => $string], ['id', 'name']);
        $schemas['Role'] = $object(['id' => $integer, 'name' => $string, 'status' => $boolean, 'version' => $integer, 'is_system' => $boolean, 'permissions' => $array($ref('Permission'))], ['id', 'name', 'status', 'version', 'is_system', 'permissions']);
        $schemas['RoleInput'] = $object(['name' => $string, 'status' => $boolean, 'permissions' => $array(['type' => 'string', 'enum' => EntityRegistry::permissions()]), 'version' => $integer], ['name', 'status', 'permissions']);
        $schemas['User'] = $object(['id' => $integer, 'name' => $string, 'username' => $string, 'email' => $nullable, 'status' => $boolean, 'version' => $integer, 'person_id' => ['type' => ['integer', 'null']], 'role_id' => $integer, 'role_name' => $string, 'company_ids' => $ids], ['id', 'name', 'username', 'email', 'status', 'version', 'person_id', 'role_id', 'role_name', 'company_ids']);
        $schemas['UserInput'] = $object(['name' => $string, 'username' => $string, 'email' => $nullable, 'status' => $boolean, 'person_id' => ['type' => ['integer', 'null']], 'role_id' => $integer, 'company_ids' => $ids, 'password' => ['type' => 'string', 'minLength' => 12, 'writeOnly' => true], 'password_confirmation' => ['type' => 'string', 'writeOnly' => true], 'version' => $integer], ['name', 'username', 'status', 'role_id', 'company_ids']);
        $schemas['UserCreate'] = $schemas['UserInput'];
        $schemas['UserCreate']['required'] = [...$schemas['UserInput']['required'], 'password', 'password_confirmation'];
        $schemas['UserUpdate'] = $schemas['UserInput'];
        $schemas['UserUpdate']['required'][] = 'version';
        $schemas['RoleUpdate'] = $schemas['RoleInput'];
        $schemas['RoleUpdate']['required'][] = 'version';
        $schemas['EmployeeInput'] = $object(['joining_date' => ['type' => ['string', 'null'], 'format' => 'date'], 'person_version' => $integer, 'salary' => ['type' => ['string', 'null'], 'pattern' => '^[0-9]{1,17}(\\.[0-9]{1,2})?$'], 'type_ids' => ['type' => 'array', 'minItems' => 1, 'uniqueItems' => true, 'items' => $integer], 'version' => $integer], ['salary', 'type_ids', 'version']);
        $schemas['EmployeeProfile'] = $object(['id' => $integer, 'person_id' => $integer, 'salary' => $nullable, 'version' => $integer, 'types' => $array($ref('EmployeeTypes'))], ['id', 'person_id', 'salary', 'version', 'types']);
        $schemas['EmployeeResponse'] = $object(['data' => ['anyOf' => [$ref('EmployeeProfile'), ['type' => 'null']]], 'eligible' => $boolean], ['data', 'eligible']);
        $schemas['PersonEmployeeTypesInput'] = $object(['type_ids' => ['type' => 'array', 'maxItems' => 100, 'uniqueItems' => true, 'items' => $integer], 'version' => ['type' => 'integer', 'minimum' => 0]], ['type_ids', 'version']);
        foreach (['PeopleInput', 'PeopleUpdate'] as $schema) {
            $schemas[$schema]['properties']['employee'] = $ref('PersonEmployeeTypesInput') + ['description' => 'Save active employee types atomically with Personal Details. Requires is_employee and dedicated employee permissions; salary and inactive type history are preserved.'];
        }
        $schemas['Document'] = $object(['id' => $integer, 'person_id' => $integer, 'kind' => ['type' => 'string', 'enum' => ['profile', 'signature', 'identification']], 'document_type' => $nullable, 'document_number' => $nullable, 'expires_on' => ['type' => ['string', 'null'], 'format' => 'date'], 'original_name' => $string, 'mime_type' => $string, 'size' => $integer, 'version' => $integer, 'status' => $boolean, 'created_at' => ['type' => 'string', 'format' => 'date-time'], 'updated_at' => ['type' => 'string', 'format' => 'date-time']], ['id', 'person_id', 'kind', 'document_type', 'document_number', 'expires_on', 'original_name', 'mime_type', 'size', 'version', 'status', 'created_at', 'updated_at']);
        $schemas['DocumentInput'] = $object(['kind' => $schemas['Document']['properties']['kind'], 'document_type' => $nullable, 'document_number' => $nullable, 'expires_on' => ['type' => ['string', 'null'], 'format' => 'date'], 'file' => ['type' => 'string', 'format' => 'binary'], 'version' => $integer], ['kind', 'file']);
        $schemas['DocumentUpdate'] = $schemas['DocumentInput'];
        $schemas['DocumentUpdate']['required'][] = 'version';
        $schemas['VersionInput'] = $object(['version' => ['type' => 'integer', 'minimum' => 1]], ['version']);
        $schemas['AuditEvent'] = $object(['id' => $integer, 'user_id' => ['type' => ['integer', 'null']], 'company_id' => ['type' => ['integer', 'null']], 'action' => $string, 'entity' => $string, 'record_id' => ['type' => ['integer', 'null']], 'record_label' => $nullable, 'changes' => ['type' => 'object', 'additionalProperties' => $object(['before' => ['description' => 'Prior JSON value or redaction marker'], 'after' => ['description' => 'Current JSON value or redaction marker']], ['before', 'after'])], 'ip_address' => $nullable, 'created_at' => ['type' => 'string', 'format' => 'date-time'], 'actor' => ['anyOf' => [$object(['id' => $integer, 'name' => $string], ['id', 'name']), ['type' => 'null']]]], ['id', 'user_id', 'company_id', 'action', 'entity', 'record_id', 'record_label', 'changes', 'ip_address', 'created_at', 'actor']);
        $schemas['Dashboard'] = $object(['counts' => ['type' => 'object', 'additionalProperties' => ['anyOf' => [$object(['total' => $integer, 'active' => $integer], ['total', 'active']), ['type' => 'null']]]], 'recent_people' => $array($object(['id' => $integer, 'code' => $string, 'name' => $string, 'status' => $boolean, 'created_at' => $string], ['id', 'code', 'name', 'status', 'created_at'])), 'recent_activity' => $array($ref('AuditEvent')), 'companies' => $array($object(['id' => $integer, 'name' => $string, 'short_name' => $nullable, 'status' => $boolean, 'is_default' => $boolean, 'sub_companies_count' => $integer], ['id', 'name', 'short_name', 'status', 'is_default', 'sub_companies_count']))], ['counts', 'recent_people', 'recent_activity', 'companies']);
        $schemas['Session'] = $object(['user' => $object(['id' => $integer, 'name' => $string, 'username' => $string, 'role' => $string], ['id', 'name', 'username', 'role']), 'permissions' => $array($string), 'companies' => $array($object(['id' => $integer, 'name' => $string, 'short_name' => $nullable, 'is_default' => $boolean], ['id', 'name', 'short_name', 'is_default'])), 'portal_companies' => $array($object(['id' => $integer, 'name' => $string, 'short_name' => $nullable, 'is_default' => $boolean], ['id', 'name', 'short_name', 'is_default'])), 'entities' => ['type' => 'object', 'additionalProperties' => ['type' => 'object', 'description' => 'EntityRegistry field metadata, parent relation, label and view/create/update/delete capabilities.']]], ['user', 'permissions', 'companies', 'portal_companies', 'entities']);
        $paged = fn (string $name): array => $object(['data' => $array($ref($name)), 'meta' => $ref('PageMeta')], ['data', 'meta']);
        $one = fn (string $name): array => $object(['data' => $ref($name)], ['data']);
        $operation = function (string $path, string $method, array $output, ?array $input = null, int $status = 200, string $contentType = 'application/json') use (&$paths, $ref): void {
            preg_match_all('/\{([^}]+)\}/', $path, $matches);
            $paths[$path]['parameters'] = array_map(fn (string $p): array => ['name' => $p, 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']], $matches[1]);
            $response = ['description' => $status === 204 ? 'No content' : 'Successful response'];
            if ($status !== 204) {
                $response['content'] = ['application/json' => ['schema' => $output]];
            }
            $op = ['summary' => ucfirst($method).' '.$path, 'responses' => [$status => $response]];
            foreach ([401, 403, 404, 409, 419, 422, 429] as $code) {
                $op['responses'][$code] = ['description' => 'Request rejected', 'content' => ['application/json' => ['schema' => $ref('Error')]]];
            }
            if ($input !== null) {
                $op['requestBody'] = ['required' => true, 'content' => [$contentType => ['schema' => $input]]];
            }
            $paths[$path][$method] = $op;
        };
        $operation('/session', 'get', $ref('Session'));
        $operation('/dashboard', 'get', $ref('Dashboard'));
        $operation('/audit', 'get', $paged('AuditEvent'));
        $operation('/people/{person}/user-account', 'get', $object(['data' => ['anyOf' => [$ref('User'), ['type' => 'null']]]], ['data']));
        $operation('/users', 'get', $paged('User'));
        $schemas['User']['properties']['person_name'] = $nullable;
        $schemas['User']['required'][] = 'person_name';
        $schemas['UserLinkPerson'] = $object(['id' => $integer, 'name' => $string, 'code' => $string, 'status' => $boolean], ['id', 'name', 'code', 'status']);
        $operation('/users/linkable-people', 'get', $paged('UserLinkPerson'));
        $operation('/users', 'post', $one('User'), $ref('UserCreate'), 201);
        $operation('/users/{id}', 'put', $one('User'), $ref('UserUpdate'));
        $operation('/roles', 'get', $object(['data' => $array($ref('Role')), 'permissions' => $array($string)], ['data', 'permissions']));
        $operation('/roles', 'post', $one('Role'), $ref('RoleInput'), 201);
        $operation('/roles/{id}', 'put', $one('Role'), $ref('RoleUpdate'));
        $schemas['CompanyRoleInput'] = $object(['version' => $integer, 'classification_versions' => ['type' => 'object', 'additionalProperties' => $integer], 'items' => $array($object(['business_type_id' => $integer, 'opening_balance' => $nullable], ['business_type_id']))], ['version', 'classification_versions', 'items']);
        $schemas['CompanyRoleResponse'] = $object(['data' => ['anyOf' => [$ref('Associations'), ['type' => 'null']]], 'classifications' => $array($ref('Classifications')), 'classification_versions' => ['type' => 'object', 'additionalProperties' => $integer]], ['data', 'classifications', 'classification_versions']);
        $operation('/people/{person}/company-roles/{company}', 'get', $ref('CompanyRoleResponse'));
        $operation('/people/{person}/company-roles/{company}', 'put', $ref('CompanyRoleResponse'), $ref('CompanyRoleInput'));
        $operation('/people/{person}/employee', 'get', $ref('EmployeeResponse'));
        $operation('/people/{person}/employee', 'put', $ref('EmployeeResponse'), $ref('EmployeeInput'));
        $operation('/people/{person}/documents', 'get', $object(['data' => $array($ref('Document'))], ['data']));
        $operation('/people/{person}/documents', 'post', $one('Document'), $ref('DocumentInput'), 201, 'multipart/form-data');
        $operation('/people/{person}/documents/{id}', 'post', $one('Document'), $ref('DocumentUpdate'), 200, 'multipart/form-data');
        $operation('/people/{person}/documents/{id}', 'delete', [], $ref('VersionInput'), 204);
        $operation('/people/{person}/documents/{document}/download', 'get', []);
        $paths['/people/{person}/documents/{document}/download']['get']['responses'][200] = ['description' => 'Authorized private attachment; inline=1 permits re-encoded images only.', 'content' => ['application/octet-stream' => ['schema' => ['type' => 'string', 'format' => 'binary']]]];
        $operation('/associations/{association}/classifications/batch', 'post', $object(['data' => $array($ref('Classifications'))], ['data']), $object(['items' => ['type' => 'array', 'minItems' => 1, 'maxItems' => 30, 'items' => $ref('ClassificationsInput')]], ['items']), 201);
        foreach (['/users' => ['id', 'search', 'person_id', 'page'], '/users/linkable-people' => ['user_id', 'id', 'search', 'per_page', 'page'], '/audit' => ['search', 'entity', 'action', 'user_id', 'company_id', 'page'], '/people/{person}/documents/{document}/download' => ['inline']] as $path => $parameters) {
            $paths[$path]['get']['parameters'] = array_map(fn (string $name): array => ['in' => 'query', 'name' => $name, 'schema' => ['type' => 'string']], $parameters);
        }
    }

    public static function typescript(array $schemas): string
    {
        $result = "// Generated by php artisan erp:contracts. Do not edit by hand.\nexport type Money = string;\n";
        foreach ($schemas as $name => $schema) {
            $result .= 'export type '.$name.' = '.self::type($schema).";\n";
        }
        foreach (EntityRegistry::all() as $entity => $definition) {
            $name = str_replace(' ', '', ucwords(str_replace('-', ' ', $entity)));
            $result .= 'export type '.$name.'Record = '.$name.";\n";
        }

        return $result;
    }

    private static function type(array $schema): string
    {
        if (isset($schema['$ref'])) {
            return basename($schema['$ref']);
        }
        if (isset($schema['enum'])) {
            return implode(' | ', array_map(fn (mixed $v): string => json_encode($v), $schema['enum']));
        }
        if (isset($schema['anyOf'])) {
            return implode(' | ', array_map(self::type(...), $schema['anyOf']));
        }
        if (is_array($schema['type'] ?? null)) {
            return implode(' | ', array_map(fn (string $type): string => self::type(array_replace($schema, ['type' => $type])), $schema['type']));
        }

        return match ($schema['type'] ?? null) {
            'integer','number' => 'number','boolean' => 'boolean','null' => 'null','string' => ($schema['format'] ?? null) === 'binary' ? 'File' : 'string',
            'array' => 'Array<'.self::type($schema['items'] ?? []).'>',
            'object' => isset($schema['properties']) ? '{ '.implode(' ', array_map(fn (string $key, array $property): string => json_encode($key).(in_array($key, $schema['required'] ?? [], true) ? '' : '?').': '.self::type($property).';', array_keys($schema['properties']), array_values($schema['properties']))).' }' : 'Record<string, '.self::type(is_array($schema['additionalProperties'] ?? null) ? $schema['additionalProperties'] : []).'>',
            default => 'unknown',
        };
    }
}
