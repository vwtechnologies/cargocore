<?php

namespace App\Console\Commands;

use App\Modules\Shared\ApiContracts;
use App\Modules\Shared\EntityRegistry;
use Illuminate\Console\Command;

class GenerateContracts extends Command
{
    protected $signature = 'erp:contracts';

    protected $description = 'Generate OpenAPI documentation and matching TypeScript entity contracts';

    public function handle(): int
    {
        $schemas = ['Error' => ['type' => 'object', 'properties' => ['message' => ['type' => 'string'], 'code' => ['type' => 'string'], 'errors' => ['type' => 'object', 'additionalProperties' => ['type' => 'array', 'items' => ['type' => 'string']]]]], 'PageMeta' => ['type' => 'object', 'properties' => ['current_page' => ['type' => 'integer'], 'last_page' => ['type' => 'integer'], 'total' => ['type' => 'integer']]], 'Session' => ['type' => 'object', 'description' => 'Authenticated user, effective permissions, assigned companies and form contracts.', 'properties' => ['user' => ['type' => 'object'], 'permissions' => ['type' => 'array', 'items' => ['type' => 'string']], 'companies' => ['type' => 'array', 'description' => 'Active companies available for record administration and access assignment.', 'items' => ['type' => 'object']], 'portal_companies' => ['type' => 'array', 'description' => 'Active companies explicitly granted through portal access, including for Super Admin. Used by the workspace switcher.', 'items' => ['type' => 'object']], 'entities' => ['type' => 'object']]]];
        $paths = [];
        foreach (EntityRegistry::all() as $entity => $definition) {
            $name = str_replace(' ', '', ucwords(str_replace('-', ' ', $entity)));
            $properties = [];
            $required = [];
            $writeRequired = [];
            if ($definition['prefix'] && ! isset($definition['fields']['code'])) {
                $properties['code'] = ['type' => 'string', 'readOnly' => true];
            }
            foreach ($definition['fields'] as $key => $field) {
                $type = $field['type'] ?? 'text';
                $p = ['title' => $field['label']];
                $p += match ($type) {
                    'number','reference' => ['type' => ['integer', 'null']], 'boolean' => ['type' => 'boolean'], 'money' => ['type' => ['string', 'null'], 'pattern' => '^-?[0-9]{1,17}(\\.[0-9]{1,2})?$'], 'date' => ['type' => ['string', 'null'], 'format' => 'date'], 'list' => ['type' => ['array', 'null'], 'items' => ['type' => 'string']], default => ['type' => ['string', 'null']]
                };
                if ($field['required'] ?? false) {
                    $required[] = $key;
                    $writeRequired[] = $key;
                    $p['type'] = is_array($p['type']) ? $p['type'][0] : $p['type'];
                }
                if (isset($field['max'])) {
                    $p['maxLength'] = $field['max'];
                }if ($field['immutable'] ?? false) {
                    $p['description'] = 'Cannot change after creation.';
                }
                $properties[$key] = $p;

            }
            if ($definition['parent']) {
                $key = $definition['parent']['key'];
                $properties[$key] = ['type' => 'integer', 'readOnly' => true];
            }
            $schemas[$name] = ['type' => 'object', 'properties' => array_merge(['id' => ['type' => 'integer', 'readOnly' => true], 'version' => ['type' => 'integer'], 'created_at' => ['type' => 'string', 'format' => 'date-time', 'readOnly' => true], 'updated_at' => ['type' => 'string', 'format' => 'date-time', 'readOnly' => true]], $properties), 'required' => array_values(array_unique(['id', 'version', 'status', ...$required]))];
            $schemas[$name.'Input'] = ['type' => 'object', 'properties' => array_filter($properties, fn ($p) => ! ($p['readOnly'] ?? false)), 'required' => $writeRequired];
            $derived = match ($entity) {
                'branches' => ['country_name', 'city_name'],'officers' => ['person_name', 'branch_name'],'accounts' => ['country_name', 'city_name', 'bank_name', 'branch_name'],'associations' => ['company_name'],'classifications' => ['business_type_name'],'person-markas' => ['marka_code', 'marka_description'],default => []
            };
            foreach ($derived as $field) {
                $schemas[$name]['properties'][$field] = ['type' => ['string', 'null'], 'readOnly' => true];
            }
            $schemas[$name.'Update'] = $schemas[$name.'Input'];
            $schemas[$name.'Update']['properties']['version'] = ['type' => 'integer', 'minimum' => 1];
            $schemas[$name.'Update']['required'][] = 'version';
            $base = $definition['parent'] ? '/'.$definition['parent']['entity'].'/{parentId}/'.$entity : '/'.$entity;
            $parentParams = $definition['parent'] ? [['name' => 'parentId', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]] : [];
            $response = ['description' => 'Record', 'content' => ['application/json' => ['schema' => ['type' => 'object', 'properties' => ['data' => ['$ref' => '#/components/schemas/'.$name]]]]]];
            $errors = [];
            foreach ([401 => 'Authentication required', 403 => 'Permission denied', 404 => 'Not found or outside scope', 409 => 'Version or reference conflict', 422 => 'Validation failed'] as $status => $description) {
                $errors[$status] = ['description' => $description, 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/Error']]]];
            }
            $paths[$base] = ['parameters' => $parentParams, 'get' => ['tags' => [$definition['module']], 'summary' => 'Search '.$definition['label'], 'parameters' => array_map(fn ($p) => ['name' => $p, 'in' => 'query', 'schema' => ['type' => 'string']], ['search', 'status', 'sort', 'direction', 'page', 'per_page', 'position_of']), 'responses' => [200 => ['description' => 'Paginated records', 'content' => ['application/json' => ['schema' => ['type' => 'object', 'properties' => ['data' => ['type' => 'array', 'items' => ['$ref' => '#/components/schemas/'.$name]], 'meta' => ['$ref' => '#/components/schemas/PageMeta']]]]]]] + $errors],
                'post' => ['tags' => [$definition['module']], 'summary' => 'Create '.$definition['label'], 'requestBody' => ['required' => true, 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/'.$name.'Input']]]], 'responses' => [201 => $response] + $errors]];
            $paths[$base.'/{id}'] = ['parameters' => [...$parentParams, ['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]], 'get' => ['tags' => [$definition['module']], 'responses' => [200 => $response] + $errors], 'put' => ['tags' => [$definition['module']], 'requestBody' => ['required' => true, 'content' => ['application/json' => ['schema' => ['$ref' => '#/components/schemas/'.$name.'Update']]]], 'responses' => [200 => $response] + $errors], 'delete' => ['tags' => [$definition['module']], 'requestBody' => ['required' => true, 'content' => ['application/json' => ['schema' => ['type' => 'object', 'required' => ['version'], 'properties' => ['version' => ['type' => 'integer']]]]]], 'responses' => [204 => ['description' => 'Deleted']] + $errors]];
            $paths[$base.'/{id}']['patch'] = $paths[$base.'/{id}']['put'];
            $paths[$base]['get']['responses'][200]['content']['application/json']['schema'] = ['anyOf' => [$paths[$base]['get']['responses'][200]['content']['application/json']['schema'], ['type' => 'object', 'properties' => ['navigation' => ['$ref' => '#/components/schemas/Navigation']], 'required' => ['navigation']]]];
            if ($definition['parent']) {
                $paths['/'.$entity] = ['get' => $paths[$base]['get']];
                $paths['/'.$entity.'/{id}'] = ['parameters' => [['name' => 'id', 'in' => 'path', 'required' => true, 'schema' => ['type' => 'integer']]], 'get' => $paths[$base.'/{id}']['get']];
            }
        }
        ApiContracts::supplement($paths, $schemas);
        $doc = ['openapi' => '3.1.0', 'info' => ['title' => 'CargoCore ERP API', 'version' => '1.0.0', 'description' => 'Same-origin session API. Obtain XSRF-TOKEN from /sanctum/csrf-cookie; send X-XSRF-TOKEN on writes. All business routes enforce account readiness and role permissions.'], 'servers' => [['url' => '/api/v1']], 'security' => [['session' => []]], 'paths' => $paths, 'components' => ['securitySchemes' => ['session' => ['type' => 'apiKey', 'in' => 'cookie', 'name' => config('session.cookie')]], 'schemas' => $schemas]];
        if (! is_dir(base_path('docs'))) {
            mkdir(base_path('docs'), 0755, true);
        }
        file_put_contents(base_path('docs/openapi.json'), json_encode($doc, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
        file_put_contents(resource_path('js/lib/contracts.generated.ts'), ApiContracts::typescript($schemas));
        $map = "# Persisted fields and screen mapping\n\nGenerated from EntityRegistry. Internal numeric IDs and immutable business codes are separate. All fields below have shared form controls in their module/detail panel.\n\n| Screen | Field | Persistence | Control |\n| --- | --- | --- | --- |\n";
        foreach (EntityRegistry::all() as $entity => $definition) {
            $table = (new $definition['model'])->getTable();
            foreach ($definition['fields'] as $key => $field) {
                $storage = ($field['virtual'] ?? false) ? 'Derived through bank_branches → cities → countries / banks' : $table.'.'.$key;
                $map .= '| '.$definition['label'].' | '.$field['label'].' | `'.$storage.'` | '.($field['type'] ?? 'text')." |\n";
            }if ($definition['prefix']) {
                $codeControl = $entity === 'employee-types' ? 'Backend only (not displayed)' : 'Read-only header';
                $map .= '| '.$definition['label'].' | Generated business code | `'.$table.'.code` | '.$codeControl.' |'."\n";
            }
        }
        $map .= "\nAdditional dedicated sections: employee_profiles.salary (PKR), employee_profile_type (multiple employee types); documents (kind, document_type, document_number, expires_on, private file metadata) for profile/signature/identification upload/view/replace; users (username, password hash, role, active status, person link), company_user and permission_role. These fields are exposed through dedicated person/administration screens. Officer name comes from the selected person's name; account country/city/bank come from its branch. Marka codes are shared masters; person_markas links multiple codes to each person without duplicating master records.\n";
        file_put_contents(base_path('docs/FIELD-MAP.md'), $map);
        $this->info('Generated docs/openapi.json and TypeScript record contracts.');

        return self::SUCCESS;
    }
}
