import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GetOrderRequest {
  orderId?: string;
  sessionId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { orderId, sessionId }: GetOrderRequest = await req.json();

    if (!orderId && !sessionId) {
      throw new Error("Order ID or session ID required");
    }

    let order;
    let orderItems;

    if (orderId) {
      // Get order by ID
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (error) throw error;
      order = data;
    } else if (sessionId) {
      // Get order by Stripe session ID
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("stripe_session_id", sessionId)
        .maybeSingle();

      if (error) throw error;
      order = data;
    }

    if (!order) {
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404,
        }
      );
    }

    // Get order items
    const { data: items, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", order.id);

    if (itemsError) throw itemsError;

    // If the order has a Stripe session, verify payment status
    if (order.stripe_session_id && order.status === "pending") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        try {
          const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
          if (session.payment_status === "paid") {
            // Update order status
            await supabase
              .from("orders")
              .update({ status: "paid" })
              .eq("id", order.id);
            order.status = "paid";

            // Create payment record if not exists
            const { data: existingPayment } = await supabase
              .from("payments")
              .select("id")
              .eq("order_id", order.id)
              .maybeSingle();

            if (!existingPayment && session.payment_intent) {
              await supabase.from("payments").insert({
                order_id: order.id,
                stripe_payment_id: session.payment_intent as string,
                status: "completed",
              });
            }
          }
        } catch (stripeError) {
          console.error("Stripe verification error:", stripeError);
        }
      }
    }

    const response = {
      order: {
        id: order.id,
        status: order.status,
        total: order.generic_total,
        items: items?.map((item) => ({
          genericName: item.generic_name,
          price: item.price,
          quantity: item.quantity,
        })) || [],
        createdAt: order.created_at,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Get order error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
