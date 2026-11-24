<?php

namespace Tests\Feature;

use App\Models\BankBranch;
use App\Models\BankBranchContact;
use App\Models\CompanyAddress;
use App\Models\Person;
use Tests\ErpTestCase;

class UnifiedBankAccountsTest extends ErpTestCase
{
    /**
     * @return array<string, mixed>
     */
    private function accountFields(BankBranch $branch, array $overrides = []): array
    {
        return array_replace(['account_title' => 'Operating account', 'account_number' => '0012Il34', 'country_id' => $branch->city->country_id, 'city_id' => $branch->city_id, 'bank_id' => $branch->bank_id, 'bank_branch_id' => $branch->id], $overrides);
    }

    public function test_our_company_account_shows_company_bank_and_address_details(): void
    {
        $this->administrator();
        $address = CompanyAddress::factory()->create(['title' => 'REGISTERED BUSINESS ADDRESS (NTN)']);
        $branch = BankBranch::factory()->create(['branch_code' => '0451']);
        $branch->bank->update(['bank_code' => 'HABB']);
        $this->postJson('/api/v1/bank-accounts', $this->accountFields($branch, ['is_our_account' => true]))->assertUnprocessable()->assertJsonValidationErrors('company_id');
        $account = $this->createRecord('bank-accounts', $this->accountFields($branch, ['is_our_account' => true, 'is_cheque' => true, 'company_id' => $address->company_id, 'company_address_id' => $address->id, 'account_type' => 'Current', 'short_title' => 'Ops', 'authorized_signatory_name' => 'Signer', 'authorized_signatory_cnic' => '35202-1234567-1', 'opening_balance_date' => '2026-07-01', 'opening_balance' => '1500.50']));
        $this->assertNull($account['person_id']);
        $this->assertTrue($account['is_our_account']);
        $this->assertSame('HABB', $account['bank_code']);
        $this->assertSame('0451', $account['branch_code']);
        $this->assertSame('REGISTERED BUSINESS ADDRESS (NTN)', $account['company_address_title']);
        $this->assertSame('3520212345671', $account['authorized_signatory_cnic']);
        $this->assertSame('CURRENT', $account['account_type']);
        $this->assertSame('1500.50', $account['opening_balance']);
        $this->getJson('/api/v1/bank-accounts?is_our_account=1&context=management')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/bank-accounts?is_beneficiary=1&context=management')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_person_tab_and_central_register_share_records_without_duplicates(): void
    {
        $this->administrator();
        $person = Person::factory()->create(['name' => 'Account Holder', 'cnic' => '4210112345671']);
        $branch = BankBranch::factory()->create();
        $account = $this->postJson("/api/v1/people/{$person->id}/accounts", $this->accountFields($branch, ['is_employee' => true]))->assertCreated()->json('data');
        $this->assertSame($person->name, $account['account_holder_name']);
        $this->assertSame('4210112345671', $account['account_holder_cnic']);
        $this->getJson('/api/v1/bank-accounts?is_employee=1&context=management')->assertOk()->assertJsonPath('data.0.id', $account['id'])->assertJsonPath('data.0.person_name', $person->name);
        $this->postJson('/api/v1/bank-accounts', $this->accountFields($branch, ['is_beneficiary' => true]))->assertUnprocessable()->assertJsonValidationErrors('account_number');
        $this->putJson("/api/v1/bank-accounts/{$account['id']}", $this->accountFields($branch, ['person_id' => $person->id, 'is_employee' => true, 'is_beneficiary' => true, 'version' => $account['version']]))->assertOk()->assertJsonPath('data.is_beneficiary', true);
        $this->assertDatabaseCount('person_bank_accounts', 1);
        $this->postJson('/api/v1/bank-accounts', $this->accountFields($branch, ['account_number' => '999', 'is_employee' => true]))->assertUnprocessable()->assertJsonValidationErrors('person_id');
        $this->postJson('/api/v1/bank-accounts', $this->accountFields($branch, ['account_number' => '999', 'account_holder_cnic' => '123']))->assertUnprocessable()->assertJsonValidationErrors('account_holder_cnic');
    }

    public function test_bank_and_branch_store_trade_hub_portals_and_branch_contacts(): void
    {
        $this->administrator();
        $branch = BankBranch::factory()->create();
        $bank = $branch->bank->refresh();
        $branch->refresh();
        $this->putJson("/api/v1/banks/{$bank->id}", ['name' => $bank->name, 'country_id' => $branch->city->country_id, 'swift_code' => 'habbpkka', 'bank_code' => 'habb', 'contact_number' => '111-111-111', 'internet_banking_url' => 'https://ib.example.test', 'corporate_banking_url' => 'https://corp.example.test', 'trade_hub_name' => 'Trade hub', 'trade_hub_address' => 'Hub address', 'version' => $bank->version])
            ->assertOk()->assertJsonPath('data.swift_code', 'HABBPKKA')->assertJsonPath('data.trade_hub_name', 'TRADE HUB');
        $this->putJson("/api/v1/banks/{$bank->id}/branches/{$branch->id}", ['name' => $branch->name, 'city_id' => $branch->city_id, 'email' => 'branch@example.test', 'portal_url' => 'https://branch.example.test', 'version' => $branch->version])
            ->assertOk()->assertJsonPath('data.email', 'BRANCH@EXAMPLE.TEST');
    }

    public function test_branch_contact_numbers_are_titled_rows_with_one_primary(): void
    {
        $this->administrator();
        $branch = BankBranch::factory()->create();
        $titles = ['Landline 1', 'Landline 2', 'Fax', 'Branch Manager', 'Operations', 'Trade Desk'];
        foreach ($titles as $index => $title) {
            $this->postJson("/api/v1/branches/{$branch->id}/branch-contacts", ['title' => $title, 'number' => '051-555000'.$index, 'is_primary' => $index < 2, 'status' => true])->assertCreated();
        }
        $this->getJson("/api/v1/branches/{$branch->id}/branch-contacts?context=management&per_page=25")->assertOk()->assertJsonCount(6, 'data');
        $this->assertSame(1, BankBranchContact::where('bank_branch_id', $branch->id)->where('is_primary', true)->count());
        $this->assertSame('LANDLINE 2', BankBranchContact::where('is_primary', true)->value('title'));
        $this->getJson("/api/v1/banks/{$branch->bank_id}/branches/{$branch->id}")->assertOk()->assertJsonPath('data.primary_contact_number', '051-5550001');
        $this->postJson("/api/v1/branches/{$branch->id}/branch-contacts", ['title' => 'Untitled'])->assertUnprocessable()->assertJsonValidationErrors('number');
        $this->deleteJson("/api/v1/banks/{$branch->bank_id}/branches/{$branch->id}", ['version' => $branch->refresh()->version])->assertUnprocessable();
    }
}
