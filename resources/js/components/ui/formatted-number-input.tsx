import React, { useState, useEffect } from 'react';
import { Input } from './input';

interface FormattedNumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'> {
    value: string | number | undefined | null;
    onChange: (value: string) => void;
}

export const FormattedNumberInput = React.forwardRef<HTMLInputElement, FormattedNumberInputProps>(
    ({ value, onChange, className, ...props }, ref) => {
        const [displayValue, setDisplayValue] = useState('');

        useEffect(() => {
            if (value === '' || value === null || value === undefined) {
                setDisplayValue('');
                return;
            }

            const strVal = String(value);
            
            if (strVal === '-') {
                setDisplayValue('-');
                return;
            }
            
            if (strVal.endsWith('.')) {
                 const intPart = strVal.replace(/[^0-9-]/g, '');
                 if (!intPart || intPart === '-') {
                     setDisplayValue(strVal);
                 } else {
                     const formatted = parseInt(intPart, 10).toLocaleString();
                     setDisplayValue(formatted + '.');
                 }
                 return;
            }

            const parts = strVal.split('.');
            let intPart = parts[0];
            const isNegative = intPart.startsWith('-');
            if (isNegative) intPart = intPart.substring(1);

            let formatted = '';
            if (intPart !== '') {
                formatted = parseInt(intPart, 10).toLocaleString();
            }

            if (isNegative) {
                formatted = '-' + formatted;
            }

            if (parts.length > 1) {
                setDisplayValue(`${formatted}.${parts[1]}`);
            } else {
                setDisplayValue(formatted);
            }
        }, [value]);

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value;
            const isNegative = raw.startsWith('-');
            let numeric = raw.replace(/[^0-9.]/g, '');
            if (isNegative) numeric = '-' + numeric;

            const parts = numeric.split('.');
            if (parts.length > 2) {
                numeric = parts[0] + '.' + parts.slice(1).join('');
            }

            onChange(numeric);
        };

        return (
            <Input
                ref={ref}
                type="text"
                inputMode="decimal"
                value={displayValue}
                onChange={handleChange}
                className={className}
                {...props}
            />
        );
    }
);

FormattedNumberInput.displayName = 'FormattedNumberInput';
