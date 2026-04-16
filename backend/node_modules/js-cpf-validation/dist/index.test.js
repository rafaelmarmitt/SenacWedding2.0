"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require(".");
describe('Tests for CPF validation', () => {
    test('Test a valid CPF without mask', () => {
        expect((0, _1.isValidCPF)("32595891049")).toBeTruthy();
    });
    test('Test a valid CPF with mask', () => {
        expect((0, _1.isValidCPF)("490.752.150-29")).toBeTruthy();
    });
    test('Test a invalid CPF', () => {
        expect((0, _1.isValidCPF)("32595891000")).toBeFalsy();
    });
    test('Test a empty CPF', () => {
        expect((0, _1.isValidCPF)('')).toBeFalsy();
    });
});
