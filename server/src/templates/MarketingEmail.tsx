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

interface MarketingEmailProps {
  title: string;
  previewText: string;
  content: string;
  ctaText?: string;
  ctaLink?: string;
}

export const MarketingEmail = ({
  title = 'Exciting Updates from BillFlow!',
  previewText = 'Check out what is new...',
  content = 'We have some exciting new features to share with you.',
  ctaText,
  ctaLink,
}: MarketingEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{title}</Heading>
          
          <Text style={text}>{content}</Text>

          {ctaText && ctaLink && (
            <Section style={btnContainer}>
              <Button style={button} href={ctaLink}>
                {ctaText}
              </Button>
            </Section>
          )}

          <Hr style={hr} />
          
          <Text style={footer}>
            You are receiving this email because you are subscribed to BillFlow updates.
            <br />
            <Link href="{{ unsubscribe_url }}" style={{ color: '#94a3b8', textDecoration: 'underline' }}>
              Unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default MarketingEmail;

const main = {
  backgroundColor: '#f8fafc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px',
  borderRadius: '12px',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
  marginTop: '40px',
  marginBottom: '40px',
};

const h1 = {
  color: '#0f172a',
  fontSize: '28px',
  fontWeight: 'bold',
  lineHeight: '40px',
  margin: '0 0 24px',
};

const text = {
  color: '#334155',
  fontSize: '16px',
  lineHeight: '26px',
  marginBottom: '24px',
  whiteSpace: 'pre-wrap' as const,
};

const btnContainer = {
  textAlign: 'center' as const,
  marginTop: '32px',
  marginBottom: '32px',
};

const button = {
  backgroundColor: '#0f172a',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 28px',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '32px 0',
};

const footer = {
  color: '#94a3b8',
  fontSize: '13px',
  textAlign: 'center' as const,
  lineHeight: '20px',
};
