import { isValidCPF } from ".";

describe('Tests for CPF validation', () => {

    test('Test a valid CPF without mask', () => {
        expect(isValidCPF("32595891049")).toBeTruthy();
    });

    test('Test a valid CPF with mask', () => {
        expect(isValidCPF("490.752.150-29")).toBeTruthy();
    });
    
    test('Test a invalid CPF', () => {
        expect(isValidCPF("32595891000")).toBeFalsy();
    });
    
    test('Test a empty CPF', () => {
        expect(isValidCPF('')).toBeFalsy();
    });
    
});