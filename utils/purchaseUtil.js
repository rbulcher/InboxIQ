//PLUS TIER
// curl https://api.stripe.com/v1/checkout/sessions \
//   -u "{{SECRET_KEY}}" \
//   --data-urlencode success_url="https://dashboard.stripe.com/billing/starter-guide/checkout-success" \
//   -d "payment_method_types[0]"=card
//   -d "line_items[0][price]"=price_1PfYQvD37vph7eljfOA62Eq0 \
//   -d "line_items[0][quantity]"=1 \
//   -d mode=subscription

// PRO TIER
// curl https://api.stripe.com/v1/checkout/sessions \
//   -u "{{SECRET_KEY}}" \
//   --data-urlencode success_url="https://dashboard.stripe.com/billing/starter-guide/checkout-success" \
//   -d "payment_method_types[0]"=card
//   -d "line_items[0][price]"=price_1PfYRQD37vph7eljaXtlI0QL \
//   -d "line_items[0][quantity]"=1 \
//   -d mode=subscription

//stripe key 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

export async function callStripeCheckoutAPI(priceId) {
    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
            Authorization: `Bearer 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`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            success_url: "https://dashboard.stripe.com/billing/starter-guide/checkout-success",
            payment_method_types: "card",
            "line_items[0][price]": priceId,
            "line_items[0][quantity]": 1,
            mode: "subscription",
        }),
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}
