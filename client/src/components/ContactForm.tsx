import { useState } from 'react';
import { sendContactMessage } from '../services/contactService';

const INITIAL = { name: '', email: '', subject: '', message: '' };

type Status = 'idle' | 'sending' | 'success' | 'error';

/**
 * Contact form with accessible validation and honest submission states.
 * "Message sent" is shown ONLY when the configured backend confirms delivery.
 * Rendered only when GET /api/contact/status reports the form as available.
 */
export default function ContactForm() {
  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [serverError, setServerError] = useState('');

  const set = (key: keyof typeof INITIAL) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev));
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (!values.name.trim()) next.name = 'Please enter your name.';
    if (!values.email.trim()) next.email = 'Please enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
      next.email = 'Please enter a valid email address.';
    if (!values.subject.trim()) next.subject = 'Please enter a subject.';
    if (values.message.trim().length < 10) next.message = 'Please write at least 10 characters so we can help.';
    return next;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      const firstKey = Object.keys(next)[0];
      document.getElementById(`contact-${firstKey}`)?.focus();
      return;
    }
    setStatus('sending');
    setServerError('');
    try {
      await sendContactMessage(values);
      setStatus('success');
      setValues(INITIAL);
    } catch (err) {
      setStatus('error');
      setServerError(err instanceof Error ? err.message : 'Your message could not be sent.');
    }
  };

  const field = (key: 'name' | 'email' | 'subject', label: string, type = 'text') => (
    <div className="form-field">
      <label htmlFor={`contact-${key}`}>{label}</label>
      <input
        id={`contact-${key}`}
        type={type}
        name={key}
        value={values[key]}
        onChange={set(key)}
        aria-invalid={Boolean(errors[key])}
        aria-describedby={errors[key] ? `contact-${key}-error` : undefined}
        required
      />
      {errors[key] && (
        <p className="form-field__error" id={`contact-${key}-error`}>
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <form className="contact-form" onSubmit={onSubmit} noValidate>
      <div className="contact-form__grid">
        {field('name', 'Your name')}
        {field('email', 'Your email', 'email')}
      </div>
      {field('subject', 'Subject')}

      <div className="form-field">
        <label htmlFor="contact-message">Message</label>
        <textarea
          id="contact-message"
          name="message"
          rows={6}
          value={values.message}
          onChange={set('message')}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? 'contact-message-error' : undefined}
          required
        />
        {errors.message && (
          <p className="form-field__error" id="contact-message-error">
            {errors.message}
          </p>
        )}
      </div>

      <div className="contact-form__footer">
        <button className="btn btn--gold btn--lg" type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send message'}
        </button>
        <p
          className={`contact-form__status${status === 'error' ? ' contact-form__status--error' : ''}`}
          role="status"
          aria-live="polite"
        >
          {status === 'success' && 'Message sent — thank you, we will get back to you shortly.'}
          {status === 'error' && serverError}
        </p>
      </div>
    </form>
  );
}
