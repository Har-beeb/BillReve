import React from 'react';
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Button,
} from '@react-email/components';

interface InvoiceEmailProps {
  type: 'INVOICE' | 'QUOTE';
  documentNumber: string;
  clientName: string;
  amount: string;
  dueDate?: string;
  businessName: string;
  paymentLink?: string;
  customMessage?: string;
}

export const DocumentEmail = ({
  type = 'INVOICE',
  documentNumber = '#INV-001',
  clientName = 'Client',
  amount = '$0.00',
  dueDate,
  businessName = 'BillFlow',
  paymentLink,
  customMessage,
}: InvoiceEmailProps) => {
  const isInvoice = type === 'INVOICE';

  return (
    <Html>
      <Head />
      <Preview>
        {isInvoice ? `New invoice ${documentNumber} for ${amount}` : `New quote ${documentNumber} from ${businessName}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {isInvoice ? 'New Invoice' : 'New Quote'}
          </Heading>
          
          <Text style={text}>Hi {clientName},</Text>
          
          <Text style={text}>
            {businessName} has sent you a new {type.toLowerCase()} (<strong>{documentNumber}</strong>) for <strong>{amount}</strong>.
          </Text>

          {customMessage && (
            <Section style={messageContainer}>
              <Text style={messageText}>{customMessage}</Text>
            </Section>
          )}

          {dueDate && isInvoice && (
            <Text style={text}>
              Payment is due by {dueDate}.
            </Text>
          )}

          {paymentLink && isInvoice && (
            <Section style={btnContainer}>
              <Button style={button} href={paymentLink}>
                View & Pay Invoice
              </Button>
            </Section>
          )}
          
          {(!paymentLink || !isInvoice) && (
            <Text style={text}>
              Please find the PDF document attached to this email.
            </Text>
          )}

          <Hr style={hr} />
          
          <Text style={footer}>
            Sent via BillFlow on behalf of {businessName}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default DocumentEmail;

const main = {
  backgroundColor: '#f8fafc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px',
  borderRadius: '8px',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  marginTop: '40px',
  marginBottom: '40px',
};

const h1 = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '40px',
  margin: '0 0 20px',
};

const text = {
  color: '#334155',
  fontSize: '16px',
  lineHeight: '24px',
  marginBottom: '16px',
};

const btnContainer = {
  textAlign: 'center' as const,
  marginTop: '32px',
  marginBottom: '32px',
};

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '32px 0',
};

const footer = {
  color: '#94a3b8',
  fontSize: '14px',
  textAlign: 'center' as const,
};

const messageContainer = {
  backgroundColor: '#f1f5f9',
  padding: '16px',
  borderRadius: '8px',
  margin: '24px 0',
  whiteSpace: 'pre-wrap' as const,
};

const messageText = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0',
};
