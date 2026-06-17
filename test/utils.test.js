import { describe, it, expect } from 'vitest';
import { 
  extractEmails, 
  extractPhones,
  scoreLead, 
  recommendAngle, 
  createPersonalizationPoint,
  buildEmailDraft,
  buildFollowUpEmailDraft
} from '../netlify/functions/utils.js';

describe('Lead Enrichment Utility Tests', () => {
  
  // 1. Email Extraction & Obfuscation Decoding
  describe('extractEmails', () => {
    it('should extract simple email addresses', () => {
      const html = '<p>Contact us at contact@prashainfotech.com or support@acme.com</p>';
      const emails = extractEmails(html);
      expect(emails).toContain('contact@prashainfotech.com');
      expect(emails).toContain('support@acme.com');
    });

    it('should decode obfuscated [at] and (dot) formats', () => {
      const html = '<div>Reach out to: sales [at] prashainfotech (dot) com</div>';
      const emails = extractEmails(html);
      expect(emails).toContain('sales@prashainfotech.com');
    });

    it('should filter out bad/mock emails', () => {
      const html = '<p>admin@example.com, test@domain.com, sales@prashainfotech.com</p>';
      const emails = extractEmails(html);
      expect(emails).toContain('sales@prashainfotech.com');
      expect(emails).not.toContain('admin@example.com');
      expect(emails).not.toContain('test@domain.com');
    });
  });

  // 2. Phone Extraction
  describe('extractPhones', () => {
    it('should extract standard phone numbers', () => {
      const html = '<span>Call us at +91 63770-9050 or 123-456-7890</span>';
      const phones = extractPhones(html);
      expect(phones).toContain('+91 63770-9050');
      expect(phones).toContain('123-456-7890');
    });
  });

  // 3. Lead Scoring Logic
  describe('scoreLead', () => {
    it('should calculate correct lead score and high quality', () => {
      const mockResult = {
        hasWebsite: true,
        primaryEmail: 'sales@prashainfotech.com',
        phone: '+91 6377090502',
        contactPage: 'https://prashainfotech.com/contact',
        hasHttps: true,
        text: 'We provide managed IT services, cloud systems, and cyber security backups in Vadodara.'
      };
      
      const score = scoreLead(mockResult, '123 Tech Park, Vadodara', 'Vadodara');
      expect(score.score).toBeGreaterThanOrEqual(80);
      expect(score.quality).toBe('High');
      expect(score.reason).toContain('website active');
      expect(score.reason).toContain('email found');
      expect(score.reason).toContain('phone found');
      expect(score.reason).toContain('city matches website');
    });

    it('should classify sparse data as Needs Review quality (score < 40)', () => {
      const mockResult = {
        hasWebsite: true,
        primaryEmail: '',
        phone: '',
        contactPage: '',
        hasHttps: false,
        text: 'Minimal text'
      };
      
      const score = scoreLead(mockResult, '', '');
      expect(score.score).toBeLessThan(40);
      expect(score.quality).toBe('Needs Review');
    });
  });

  // 4. Recommended Angle
  describe('recommendAngle', () => {
    it('should recommend website angle for ecommerce sites', () => {
      const result = { text: 'Check out our Shopify store with ecommerce checkout options' };
      const angle = recommendAngle(result);
      expect(angle).toBe('Website performance, maintenance, SEO, and conversion improvements');
    });

    it('should recommend medical IT support angle for clinic sites', () => {
      const result = { text: 'Dental clinic patient forms and dental support' };
      const angle = recommendAngle(result);
      expect(angle).toBe('Secure systems, appointment workflow automation, backups, and compliance-friendly IT support');
    });
  });

  // 5. Personalization Hook Context
  describe('createPersonalizationPoint', () => {
    it('should create personalization point with reviews info', () => {
      const result = { text: 'Standard business site' };
      const industry = 'salon';
      const city = 'Vadodara';
      const notes = 'Rating: 4.8 | Reviews: 152';
      
      const point = createPersonalizationPoint(result, industry, city, notes);
      expect(point).toContain('your booking system in Vadodara');
      expect(point).toContain('4.8 stars');
      expect(point).toContain('152 reviews');
    });
  });

  // 6. Email Draft Generation
  describe('buildEmailDraft', () => {
    it('should compile first email details correctly', () => {
      const lead = {
        'Business Name': 'Acme Corp',
        'Website URL': 'https://acme.com',
        'City': 'Boston',
        'Industry': 'Software',
        'Recommended Angle': 'IT operations and cloud support',
        'Personalization Point': 'your digital forms in Boston'
      };
      
      const draft = buildEmailDraft(lead);
      expect(draft.subject).toContain('Acme Corp');
      expect(draft.body).toContain('Hi Acme Corp team');
      expect(draft.body).toContain('your digital forms in Boston');
      expect(draft.body.toLowerCase()).toContain('it operations and cloud support');
    });
  });

  // 7. Follow-up Draft Generation
  describe('buildFollowUpEmailDraft', () => {
    it('should compile follow-up details correctly', () => {
      const lead = {
        'Business Name': 'Acme Corp',
        'Email Subject': 'Acme Corp - quick digital improvement idea',
        'Recommended Angle': 'IT support and security',
        'Personalization Point': 'booking workflow'
      };
      
      const draft = buildFollowUpEmailDraft(lead);
      expect(draft.subject).toBe('Re: Acme Corp - quick digital improvement idea');
      expect(draft.body).toContain('Hi Acme Corp team');
      expect(draft.body).toContain('follow up on my last email');
    });
  });

});
