// Chit fund math engine.
// Spec:
//   base_installment    = chit_value / duration_months
//   total_discount      = chit_value - winning_bid
//   company_commission  = chit_value * (commission_rate / 100)
//   net_discount        = total_discount - company_commission
//   per_seat_discount   = net_discount / total_seats_in_group
//   member_share        = per_seat_discount * seat_count
// Non-prized: chit_amount_due = base_installment - member_share
// Prized:     chit_amount_due = base_installment

export interface CalcInput {
  chit_value: number;
  duration_months: number;
  winning_bid: number;
  commission_rate: number;          // percent, e.g. 5
  total_seats_in_group: number;
}

export interface CalcResult {
  base_installment: number;
  total_discount: number;
  company_commission: number;
  net_discount: number;
  per_seat_discount: number;
}

export function computeGroupTotals(input: CalcInput): CalcResult {
  const base_installment = input.chit_value / input.duration_months;
  const total_discount = input.chit_value - input.winning_bid;
  const company_commission = input.chit_value * (input.commission_rate / 100);
  const net_discount = total_discount - company_commission;
  const per_seat_discount =
    input.total_seats_in_group > 0 ? net_discount / input.total_seats_in_group : 0;
  return { base_installment, total_discount, company_commission, net_discount, per_seat_discount };
}

export function computeMemberDue(opts: {
  base_installment: number;
  per_seat_discount: number;
  seat_count: number;
  prized: boolean;
}): { share_of_discount: number; chit_amount_due: number } {
  const share_of_discount = opts.per_seat_discount * opts.seat_count;
  const chit_amount_due = opts.prized
    ? opts.base_installment * opts.seat_count
    : (opts.base_installment - opts.per_seat_discount) * opts.seat_count;
  return { share_of_discount, chit_amount_due };
}
