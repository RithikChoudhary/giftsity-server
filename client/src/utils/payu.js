/**
 * Redirect the browser to PayU's Hosted Checkout by building a hidden form
 * and submitting it as a POST request.
 *
 * @param {{ action: string, params: Object }} payu - returned by the server
 *   order-creation endpoints (`buildPaymentRequest` output).
 */
export function submitPayuForm(payu) {
  if (!payu || !payu.action || !payu.params) {
    throw new Error('Invalid PayU payment payload');
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = payu.action;
  form.style.display = 'none';

  Object.entries(payu.params).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value == null ? '' : String(value);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
