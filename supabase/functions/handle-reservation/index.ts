
// Follow these steps to deploy this Edge Function in your Supabase project:
// 1. Run `supabase functions new handle-reservation` to create this function locally
// 2. Copy this code into the index.ts file
// 3. Set your Resend API key in Supabase secrets: `supabase secrets set RESEND_API_KEY=re_123456789`
// 4. Deploy the function: `supabase functions deploy handle-reservation`

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ReservationData {
  name: string;
  email: string;
  date: string;
  time: string;
  guests: string;
  message: string;
  reservationType: "table" | "event";
  eventType?: string;
  attendees?: string;
  eventDescription?: string;
}

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 500; // milliseconds

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Helper function to create consistent response objects
function createResponse(body: any, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

// Helper function to validate reservation data
function validateReservationData(data: ReservationData): { valid: boolean; message?: string } {
  if (!data.name || !data.email || !data.date || !data.time || !data.guests || !data.reservationType) {
    return { 
      valid: false, 
      message: 'Missing required fields. Please fill all required information.' 
    };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(data.email)) {
    return { valid: false, message: 'Invalid email format.' };
  }

  // Date validation (ensure it's not in the past)
  const reservationDate = new Date(data.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (reservationDate < today) {
    return { valid: false, message: 'Reservation date cannot be in the past.' };
  }

  return { valid: true };
}

// Function to retry database operations
async function retryOperation<T>(
  operation: () => Promise<T>, 
  maxRetries: number = MAX_RETRIES,
  delay: number = RETRY_DELAY
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        // Wait before next retry
        await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1))); 
        // Exponential backoff
      }
    }
  }
  
  throw lastError || new Error('Operation failed after maximum retries');
}

serve(async (req) => {
  try {
    // Handle OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    // Only accept POST requests
    if (req.method !== 'POST') {
      return createResponse({ error: 'Method not allowed' }, 405);
    }

    // Parse and validate request body
    let reservationData: ReservationData;
    try {
      reservationData = await req.json();
      console.log('Received reservation data:', JSON.stringify(reservationData));
    } catch (error) {
      console.error('Error parsing request body:', error);
      return createResponse({ 
        error: 'Invalid request format', 
        details: 'Could not parse JSON body' 
      }, 400);
    }

    // Validate reservation data
    const validation = validateReservationData(reservationData);
    if (!validation.valid) {
      return createResponse({ 
        error: 'Validation error', 
        message: validation.message 
      }, 400);
    }

    // Create a Supabase client with correct environment variables
    // Note: Using Deno.env.get() to get the environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://euoujmsyxohoaogklndx.supabase.co';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1b3VqbXN5eG9ob2FvZ2tsbmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE0NTEzNTAsImV4cCI6MjA1NzAyNzM1MH0.QSAubqJCynt6HfQ6qMdE8kUcvSvl2ekwSUVK6YNjSqc';
    
    console.log('Connecting to Supabase:', supabaseUrl);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Store the reservation in the database with retry mechanism
    let dbResult;
    try {
      dbResult = await retryOperation(async () => {
        const { data, error } = await supabase
          .from('reservations')
          .insert([
            {
              name: reservationData.name,
              email: reservationData.email,
              date: reservationData.date,
              time: reservationData.time,
              guests: reservationData.guests,
              message: reservationData.message,
              reservation_type: reservationData.reservationType,
              event_type: reservationData.eventType,
              attendees: reservationData.attendees,
              event_description: reservationData.eventDescription,
              created_at: new Date().toISOString()
            }
          ])
          .select();
          
        if (error) throw error;
        return data;
      });
      
      console.log('Reservation stored successfully:', dbResult);
    } catch (error) {
      console.error('Failed to store reservation after retries:', error);
      return createResponse({ 
        error: 'Database error', 
        message: 'We could not save your reservation. Please try again later or contact us directly.',
        details: error.message
      }, 500);
    }

    // 2. Send an email notification using Resend only after successful DB insertion
    const resendApiKey = Deno.env.get('RESEND_API_KEY') || "re_123456789";
    const adminEmail = 'restaurantdejorgitoadm@gmail.com';
    
    // Email template
    let emailContent = `
      <h1>Nueva Reserva</h1>
      <p><strong>Nombre:</strong> ${reservationData.name}</p>
      <p><strong>Correo:</strong> ${reservationData.email}</p>
      <p><strong>Fecha:</strong> ${reservationData.date}</p>
      <p><strong>Hora:</strong> ${reservationData.time}</p>
      <p><strong>Invitados:</strong> ${reservationData.guests}</p>
      <p><strong>Mensaje:</strong> ${reservationData.message || 'N/A'}</p>
    `;

    // Add event-specific information if applicable
    if (reservationData.reservationType === 'event') {
      emailContent += `
        <h2>Detalles del Evento</h2>
        <p><strong>Tipo de Evento:</strong> ${reservationData.eventType}</p>
        <p><strong>Cantidad de Asistentes:</strong> ${reservationData.attendees}</p>
        <p><strong>Descripción del Evento:</strong> ${reservationData.eventDescription || 'N/A'}</p>
      `;
    }

    // Try to send email with retry mechanism
    let emailSuccess = false;
    try {
      await retryOperation(async () => {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${resendApiKey}`
          },
          body: JSON.stringify({
            from: 'Restaurant - El Rincón de Jorgito <restaurantdejorgitoadm@gmail.com>',
            to: [adminEmail, reservationData.email], // Send to both admin and customer
            subject: `Nueva Reserva: ${reservationData.name}`,
            html: emailContent
          })
        });

        if (!emailResponse.ok) {
          const emailError = await emailResponse.text();
          console.error('Error sending email:', emailError);
          throw new Error(`Email sending failed: ${emailError}`);
        }
        
        emailSuccess = true;
        return await emailResponse.json();
      });
      
      console.log('Email notification sent successfully');
    } catch (error) {
      console.error('Failed to send email after retries:', error);
      // We continue even if email fails - we'll let the user know but reservation was saved
    }

    // Return success response with email status
    return createResponse({ 
      success: true, 
      message: 'Reservation submitted successfully',
      emailSent: emailSuccess,
      reservationId: dbResult?.[0]?.id || null,
      emailNote: emailSuccess ? null : 'Confirmation email could not be sent, but your reservation has been registered.'
    }, 200);

  } catch (error) {
    console.error('Unexpected error:', error);
    return createResponse({ 
      error: 'Internal server error', 
      message: 'An unexpected error occurred. Please try again later.',
      details: error.message 
    }, 500);
  }
});
