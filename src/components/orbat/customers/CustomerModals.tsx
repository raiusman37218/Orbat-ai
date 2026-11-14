'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import {
  Button,
  Field,
  Input,
  Modal,
  Select,
  Textarea,
  useOrbToast,
} from '@/components/orbat/primitives';
import { errorMessage } from '@/lib/errors/user-error';
import {
  addCustomerOrder,
  createCustomer,
  createCustomerSegment,
  createTicketForCustomer,
  importCustomersFromCsv,
  updateCustomer,
  type CustomerRecord,
  type CustomerSegmentRecord,
} from '@/lib/data/customers';
import type { TicketChannel, TicketPriority, TicketType } from '@/types/database';

const SEGMENT_CHOICES = ['Customer', 'VIP', 'Churn risk', 'New', 'Lead', 'Wholesale'] as const;

export function AddCustomerModal({
  open,
  workspaceId,
  onClose,
  onCreated,
}: {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onCreated: (customerId: string) => void;
}) {
  const toast = useOrbToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [segment, setSegment] = useState('Customer');
  const [plan, setPlan] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('English');
  const [tagsRaw, setTagsRaw] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const tags = tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      const created = await createCustomer(workspaceId, {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        segment,
        plan: plan.trim() || null,
        ipLocationCity: city.trim() || null,
        ipLocationCountry: country.trim() || null,
        language: language.trim() || null,
        tags,
        marketingOptIn,
      });
      toast.show({ tone: 'ok', message: `Added ${name.trim()}` });
      setName('');
      setEmail('');
      setPhone('');
      setCompany('');
      setPlan('');
      setCity('');
      setCountry('');
      setTagsRaw('');
      setMarketingOptIn(false);
      onCreated(created.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Add customer"
      description="Create a customer profile synced across Inbox, Tickets, and Calls."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="add-customer-form" loading={busy}>
            Add customer
          </Button>
        </>
      }
    >
      <form id="add-customer-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="o-alert o-alert--bad" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sarah Johnson"
              required
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sarah@example.com"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Phone">
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 (512) 555-0148"
            />
          </Field>
          <Field label="Company">
            <Input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Studios"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Segment">
            <Select value={segment} onChange={(e) => setSegment(e.target.value)}>
              {SEGMENT_CHOICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plan / Tier">
            <Input
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="Gold / Enterprise"
            />
          </Field>
          <Field label="Language">
            <Input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="English"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="City">
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Austin" />
          </Field>
          <Field label="Country">
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="United States"
            />
          </Field>
        </div>

        <Field label="Tags" hint="Comma-separated labels (e.g. VIP, Repeat buyer)">
          <Input
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
            placeholder="VIP, Repeat buyer"
          />
        </Field>

        <label className="flex items-center gap-2 text-[13.5px] text-o-text-2 cursor-pointer">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span>Opted into email & SMS marketing updates</span>
        </label>
      </form>
    </Modal>
  );
}

export function EditCustomerModal({
  open,
  workspaceId,
  customer,
  onClose,
  onSaved,
}: {
  open: boolean;
  workspaceId: string;
  customer: CustomerRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useOrbToast();
  const [name, setName] = useState(customer.name || '');
  const [email, setEmail] = useState(customer.email || '');
  const [phone, setPhone] = useState(customer.phone || '');
  const [company, setCompany] = useState(customer.company || '');
  const [segment, setSegment] = useState(customer.segment || 'Customer');
  const [plan, setPlan] = useState(customer.plan || '');
  const [city, setCity] = useState(customer.ip_location_city || '');
  const [country, setCountry] = useState(customer.ip_location_country || '');
  const [language, setLanguage] = useState(customer.language || '');
  const [timezone, setTimezone] = useState(customer.timezone || '');
  const [marketingOptIn, setMarketingOptIn] = useState(Boolean(customer.marketing_opt_in));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateCustomer(workspaceId, customer.id, {
        name: name.trim() || customer.name,
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        segment,
        plan: plan.trim() || null,
        ipLocationCity: city.trim() || null,
        ipLocationCountry: country.trim() || null,
        language: language.trim() || null,
        timezone: timezone.trim() || null,
        marketingOptIn,
      });
      toast.show({ tone: 'ok', message: 'Customer details saved' });
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Edit customer details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="edit-customer-form" loading={busy}>
            Save changes
          </Button>
        </>
      }
    >
      <form id="edit-customer-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="o-alert o-alert--bad" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Company">
            <Input value={company} onChange={(e) => setCompany(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Segment">
            <Select value={segment} onChange={(e) => setSegment(e.target.value)}>
              {SEGMENT_CHOICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Plan">
            <Input value={plan} onChange={(e) => setPlan(e.target.value)} />
          </Field>
          <Field label="Language">
            <Input value={language} onChange={(e) => setLanguage(e.target.value)} />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="City">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="Country">
            <Input value={country} onChange={(e) => setCountry(e.target.value)} />
          </Field>
          <Field label="Timezone">
            <Input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/Chicago"
            />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-[13.5px] text-o-text-2 cursor-pointer">
          <input
            type="checkbox"
            checked={marketingOptIn}
            onChange={(e) => setMarketingOptIn(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span>Marketing opt-in enabled</span>
        </label>
      </form>
    </Modal>
  );
}

export function ImportCsvModal({
  open,
  workspaceId,
  onClose,
  onImported,
}: {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const toast = useOrbToast();
  const [csvText, setCsvText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) {
      setError('Paste CSV rows or select a .csv file first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await importCustomersFromCsv(workspaceId, csvText);
      toast.show({
        tone: 'ok',
        message: `Imported ${res.created} new, updated ${res.updated}${res.skipped ? `, skipped ${res.skipped}` : ''}.`,
      });
      setCsvText('');
      onImported();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Import customers CSV"
      description="Upserts by email when present. Supported headers: name, email, phone, company, segment, country, city, plan, tags."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="import-csv-form" loading={busy}>
            Import rows
          </Button>
        </>
      }
    >
      <form id="import-csv-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="o-alert o-alert--bad" role="alert">
            {error}
          </div>
        ) : null}

        <label className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-o-border-strong bg-o-surface-2 px-4 py-3 text-[13px] cursor-pointer hover:border-o-accent">
          <span className="flex items-center gap-2 font-medium text-o-text">
            <Upload size={15} aria-hidden="true" />
            Choose a .csv file
          </span>
          <span className="text-o-text-3">Max 500 rows per import</span>
          <input type="file" accept=".csv,text/csv" onChange={handleFile} className="sr-only" />
        </label>

        <Field
          label="CSV data"
          hint="First row must be column headers. Example: name,email,company,segment,country"
        >
          <Textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={7}
            placeholder={'name,email,company,segment,country\nSarah Johnson,sarah@example.com,Lumen Home,VIP,United States'}
            className="font-mono text-[12.5px]"
          />
        </Field>
      </form>
    </Modal>
  );
}

export function NewSegmentModal({
  open,
  workspaceId,
  initialCountry,
  initialMinLtvDollars,
  onClose,
  onCreated,
}: {
  open: boolean;
  workspaceId: string;
  initialCountry: string;
  initialMinLtvDollars: string;
  onClose: () => void;
  onCreated: (segment: CustomerSegmentRecord) => void;
}) {
  const toast = useOrbToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [segmentTag, setSegmentTag] = useState('');
  const [country, setCountry] = useState(initialCountry);
  const [minLtvDollars, setMinLtvDollars] = useState(initialMinLtvDollars);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const filters: CustomerSegmentRecord['filters'] = {};
      if (segmentTag) filters.segmentKey = segmentTag;
      if (country.trim()) filters.country = country.trim();
      const parsedMin = Number(minLtvDollars);
      if (minLtvDollars.trim() && Number.isFinite(parsedMin) && parsedMin >= 0) {
        filters.minLtvCents = Math.round(parsedMin * 100);
      }

      const created = await createCustomerSegment(workspaceId, {
        name: name.trim(),
        description: description.trim() || undefined,
        filters,
      });
      toast.show({ tone: 'ok', message: `Segment "${created.name}" created` });
      setName('');
      setDescription('');
      onCreated(created);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New customer segment"
      description="Save dynamic audience rules in the left segments panel."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-segment-form" loading={busy}>
            Create segment
          </Button>
        </>
      }
    >
      <form id="new-segment-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="o-alert o-alert--bad" role="alert">
            {error}
          </div>
        ) : null}

        <Field label="Segment name">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="High-value US buyers"
            required
          />
        </Field>

        <Field label="Description (optional)">
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Customers with $500+ LTV in US"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Tier / segment">
            <Select value={segmentTag} onChange={(e) => setSegmentTag(e.target.value)}>
              <option value="">Any tier</option>
              {SEGMENT_CHOICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Country">
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="United States"
            />
          </Field>
          <Field label="Min LTV ($)">
            <Input
              type="number"
              min="0"
              step="1"
              value={minLtvDollars}
              onChange={(e) => setMinLtvDollars(e.target.value)}
              placeholder="500"
            />
          </Field>
        </div>
      </form>
    </Modal>
  );
}

export function AddOrderModal({
  open,
  workspaceId,
  visitorId,
  onClose,
  onAdded,
}: {
  open: boolean;
  workspaceId: string;
  visitorId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const toast = useOrbToast();
  const [orderNumber, setOrderNumber] = useState('');
  const [itemsSummary, setItemsSummary] = useState('');
  const [status, setStatus] = useState<'pending' | 'paid' | 'fulfilled' | 'refunded' | 'cancelled'>('paid');
  const [totalDollars, setTotalDollars] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedTotal = Number(totalDollars);
    if (!Number.isFinite(parsedTotal) || parsedTotal < 0) {
      setError('Enter a valid non-negative order amount.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addCustomerOrder(workspaceId, visitorId, {
        orderNumber: orderNumber.trim(),
        status,
        currency,
        totalCents: Math.round(parsedTotal * 100),
        itemsSummary: itemsSummary.trim() || undefined,
      });
      toast.show({ tone: 'ok', message: `Order ${orderNumber.trim()} recorded` });
      setOrderNumber('');
      setItemsSummary('');
      setTotalDollars('');
      onAdded();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record order"
      description="Adding an order updates this customer's order count and lifetime value automatically."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="add-order-form" loading={busy}>
            Save order
          </Button>
        </>
      }
    >
      <form id="add-order-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="o-alert o-alert--bad" role="alert">
            {error}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Order number">
            <Input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="#ORD-2048"
              required
            />
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as 'pending' | 'paid' | 'fulfilled' | 'refunded' | 'cancelled')
              }
            >
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="refunded">Refunded</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Total ($)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={totalDollars}
              onChange={(e) => setTotalDollars(e.target.value)}
              placeholder="148.00"
              required
            />
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="CAD">CAD</option>
            </Select>
          </Field>
        </div>

        <Field label="Items summary">
          <Input
            value={itemsSummary}
            onChange={(e) => setItemsSummary(e.target.value)}
            placeholder="Linen Throw (Sand), Ceramic Mug x2"
          />
        </Field>
      </form>
    </Modal>
  );
}

export function CreateCustomerTicketModal({
  open,
  workspaceId,
  customer,
  onClose,
  onCreated,
}: {
  open: boolean;
  workspaceId: string;
  customer: CustomerRecord;
  onClose: () => void;
  onCreated: (ticketId: string) => void;
}) {
  const toast = useOrbToast();
  const [requesterEmail, setRequesterEmail] = useState(customer.email || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [channel, setChannel] = useState<TicketChannel>('email');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [type, setType] = useState<TicketType>('question');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requesterEmail.trim()) {
      setError('Customer email is required to create a ticket.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createTicketForCustomer(workspaceId, {
        requesterName: customer.name || requesterEmail.split('@')[0] || 'Customer',
        requesterEmail: requesterEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
        channel,
        priority,
        type,
      });
      toast.show({ tone: 'ok', message: `Ticket #${created.number} created` });
      setSubject('');
      setBody('');
      onCreated(created.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={`Create ticket for ${customer.name || 'customer'}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="customer-ticket-form" loading={busy}>
            Create ticket
          </Button>
        </>
      }
    >
      <form id="customer-ticket-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="o-alert o-alert--bad" role="alert">
            {error}
          </div>
        ) : null}

        <Field label="Requester email">
          <Input
            type="email"
            value={requesterEmail}
            onChange={(e) => setRequesterEmail(e.target.value)}
            placeholder="customer@example.com"
            required
          />
        </Field>

        <Field label="Subject">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Follow-up on delayed shipment"
            required
          />
        </Field>

        <Field label="Description">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Details of the customer issue or follow-up..."
            required
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Channel">
            <Select value={channel} onChange={(e) => setChannel(e.target.value as TicketChannel)}>
              <option value="email">Email</option>
              <option value="web_form">Web form</option>
              <option value="chat">Web chat</option>
              <option value="whatsapp">WhatsApp</option>
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </Field>
          <Field label="Type">
            <Select value={type} onChange={(e) => setType(e.target.value as TicketType)}>
              <option value="question">Question</option>
              <option value="incident">Incident</option>
              <option value="problem">Problem</option>
              <option value="task">Task</option>
            </Select>
          </Field>
        </div>
      </form>
    </Modal>
  );
}
