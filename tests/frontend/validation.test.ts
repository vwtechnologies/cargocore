import {describe,it,expect} from 'vitest';
import {formSchema} from '../../resources/js/lib/validation';
describe('data-entry validation',()=>{
 const schema=formSchema({name:{label:'Name',required:true},opening_balance:{label:'Opening amount',type:'money'},cnic:{label:'CNIC'},email:{label:'Email',type:'email'}});
 it('accepts zero amounts and formatted CNIC without converting strings to floats',()=>{const result=schema.parse({name:'A person',opening_balance:'0.00',cnic:'12345-1234567-1',email:'name@example.test'});expect(result.opening_balance).toBe('0.00')});
 it('rejects missing names, fractional cents, invalid CNICs and malformed email',()=>{const result=schema.safeParse({name:'',opening_balance:'12.345',cnic:'1234',email:'invalid'});expect(result.success).toBe(false);if(!result.success)expect(result.error.issues.map(i=>i.path[0])).toEqual(['name','opening_balance','cnic','email'])});
 it('allows optional blank fields and signed opening balances',()=>{expect(schema.safeParse({name:'Valid',opening_balance:'-100.50',cnic:'',email:''}).success).toBe(true)});
});
