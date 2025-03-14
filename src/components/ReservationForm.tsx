
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ReservationData {
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

export default function ReservationForm() {
  const { translations, language } = useLanguage();
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [reservationType, setReservationType] = useState<"table" | "event">("table");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionAttempts, setSubmissionAttempts] = useState(0);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    time: "",
    guests: "",
    message: "",
    eventType: "",
    attendees: "",
    eventDescription: ""
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!date) {
      toast({
        title: language === "en" ? "Error" : "Error",
        description: language === "en" 
          ? "Please select a date for your reservation." 
          : "Por favor selecciona una fecha para tu reserva.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    // Increment submission attempts counter
    setSubmissionAttempts(prev => prev + 1);

    const reservationData: ReservationData = {
      ...formData,
      date: format(date, "yyyy-MM-dd"),
      reservationType
    };

    try {
      console.log('Submitting reservation:', reservationData);
      
      // Add a timeout to the fetch request to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch('https://euoujmsyxohoaogklndx.supabase.co/functions/v1/handle-reservation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': window.location.origin,
        },
        body: JSON.stringify(reservationData),
        signal: controller.signal,
        mode: 'cors', // Explicitly set CORS mode
      });
      
      clearTimeout(timeoutId);

      // If fetch returned but with an error status
      if (!response.ok) {
        const responseData = await response.json().catch(() => ({
          message: language === "en" 
            ? "Server returned an error without details" 
            : "El servidor devolvió un error sin detalles"
        }));
            
        throw new Error(responseData.message || 
          (language === "en" 
            ? "Failed to submit reservation. Please try again." 
            : "Error al enviar la reserva. Por favor, inténtalo de nuevo."));
      }

      const responseData = await response.json();
      console.log('Reservation response:', responseData);

      // Check if email was sent successfully
      const successMessage = language === "en" 
        ? "Reservation submitted successfully!" 
        : "¡Reserva enviada exitosamente!";
        
      const descriptionMessage = responseData.emailSent === false
        ? (language === "en" 
          ? "Your reservation was recorded, but we couldn't send a confirmation email. You'll hear from us soon!" 
          : "Tu reserva fue registrada, pero no pudimos enviar un correo de confirmación. ¡Pronto tendrás noticias nuestras!")
        : (language === "en" 
          ? "We'll confirm your reservation shortly via email." 
          : "Confirmaremos tu reserva en breve por correo electrónico.");

      toast({
        title: successMessage,
        description: descriptionMessage,
      });

      // Reset form
      setFormData({
        name: "",
        email: "",
        time: "",
        guests: "",
        message: "",
        eventType: "",
        attendees: "",
        eventDescription: ""
      });
      setDate(undefined);
      setReservationType("table");
      setSubmissionAttempts(0);
      
    } catch (error) {
      console.error('Error submitting reservation:', error);
      
      // Determine if it's a network error
      const isNetworkError = error.name === 'TypeError' && 
        (error.message === 'Failed to fetch' || error.message === 'NetworkError' || error.message === 'The user aborted a request');
      
      // Show appropriate error message
      toast({
        title: language === "en" ? "Submission Error" : "Error de Envío",
        description: isNetworkError 
          ? (language === "en"
            ? "There seems to be a network issue. Please check your internet connection and try again."
            : "Parece haber un problema de red. Por favor verifica tu conexión a internet e inténtalo de nuevo.")
          : (error.message || 
            (language === "en"
              ? "There was a problem submitting your reservation. Please try again."
              : "Hubo un problema al enviar tu reserva. Por favor, inténtalo de nuevo.")),
        variant: "destructive"
      });
      
      // If this is the third failed attempt, suggest contacting directly
      if (submissionAttempts >= 2) {
        toast({
          title: language === "en" ? "Need Help?" : "¿Necesitas ayuda?",
          description: language === "en"
            ? "You may want to contact us directly at (415) 555-0123 to make your reservation."
            : "Puedes contactarnos directamente al (415) 555-0123 para hacer tu reserva.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Reservation Type */}
      <div className="space-y-2">
        <Label htmlFor="reservation-type">
          {language === "en" ? "Reservation Type" : "Tipo de Reserva"}
        </Label>
        <Select 
          value={reservationType} 
          onValueChange={(value) => setReservationType(value as "table" | "event")}
        >
          <SelectTrigger className="bg-card">
            <SelectValue placeholder={language === "en" ? "Select reservation type" : "Selecciona tipo de reserva"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="table">{language === "en" ? "Table Reservation" : "Reserva de Mesa"}</SelectItem>
            <SelectItem value="event">{language === "en" ? "Event Reservation" : "Reserva para Evento"}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Common Fields for Both Reservation Types */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">{translations.contact.nameLabel}</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              className="bg-card"
              placeholder={language === "en" ? "John Doe" : "Juan Pérez"}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">{translations.contact.emailLabel}</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              className="bg-card"
              placeholder={language === "en" ? "john.doe@example.com" : "juan.perez@ejemplo.com"}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date">{translations.contact.dateLabel}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-card",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : language === "en" ? "Select a date" : "Selecciona una fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label htmlFor="time">{translations.contact.timeLabel}</Label>
            <Select 
              value={formData.time} 
              onValueChange={(value) => handleSelectChange("time", value)}
              required
            >
              <SelectTrigger className="bg-card">
                <SelectValue placeholder={language === "en" ? "Select time" : "Selecciona hora"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="11:30">11:30 AM</SelectItem>
                <SelectItem value="12:00">12:00 PM</SelectItem>
                <SelectItem value="12:30">12:30 PM</SelectItem>
                <SelectItem value="13:00">1:00 PM</SelectItem>
                <SelectItem value="13:30">1:30 PM</SelectItem>
                <SelectItem value="18:00">6:00 PM</SelectItem>
                <SelectItem value="18:30">6:30 PM</SelectItem>
                <SelectItem value="19:00">7:00 PM</SelectItem>
                <SelectItem value="19:30">7:30 PM</SelectItem>
                <SelectItem value="20:00">8:00 PM</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Guests */}
          <div className="space-y-2">
            <Label htmlFor="guests">{translations.contact.guestsLabel}</Label>
            <Select 
              value={formData.guests} 
              onValueChange={(value) => handleSelectChange("guests", value)}
              required
            >
              <SelectTrigger className="bg-card">
                <SelectValue placeholder={language === "en" ? "Number of guests" : "Número de invitados"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">{language === "en" ? "1 person" : "1 persona"}</SelectItem>
                <SelectItem value="2">{language === "en" ? "2 people" : "2 personas"}</SelectItem>
                <SelectItem value="3">{language === "en" ? "3 people" : "3 personas"}</SelectItem>
                <SelectItem value="4">{language === "en" ? "4 people" : "4 personas"}</SelectItem>
                <SelectItem value="5">{language === "en" ? "5 people" : "5 personas"}</SelectItem>
                <SelectItem value="6">{language === "en" ? "6 people" : "6 personas"}</SelectItem>
                <SelectItem value="7">{language === "en" ? "7 people" : "7 personas"}</SelectItem>
                <SelectItem value="8">{language === "en" ? "8+ people (call us)" : "8+ personas (llámenos)"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Special Requests */}
        <div className="space-y-2">
          <Label htmlFor="message">{translations.contact.messageLabel}</Label>
          <Textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleInputChange}
            className="min-h-[120px] resize-y bg-card"
            placeholder={language === "en" 
              ? "Any dietary restrictions or special occasions?" 
              : "¿Alguna restricción alimentaria u ocasión especial?"}
          />
        </div>
      </div>

      {/* Event-Specific Fields */}
      {reservationType === "event" && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{language === "en" ? "Event Details" : "Detalles del Evento"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Event Type */}
            <div className="space-y-2">
              <Label htmlFor="eventType">{language === "en" ? "Event Type" : "Tipo de Evento"}</Label>
              <Select 
                value={formData.eventType} 
                onValueChange={(value) => handleSelectChange("eventType", value)}
                required={reservationType === "event"}
              >
                <SelectTrigger className="bg-card">
                  <SelectValue placeholder={language === "en" ? "Select event type" : "Selecciona tipo de evento"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="birthday">{language === "en" ? "Birthday Party" : "Fiesta de Cumpleaños"}</SelectItem>
                  <SelectItem value="wedding">{language === "en" ? "Wedding" : "Boda"}</SelectItem>
                  <SelectItem value="corporate">{language === "en" ? "Corporate Meeting" : "Reunión Corporativa"}</SelectItem>
                  <SelectItem value="other">{language === "en" ? "Other" : "Otro"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Number of Attendees */}
            <div className="space-y-2">
              <Label htmlFor="attendees">{language === "en" ? "Number of Attendees" : "Número de Asistentes"}</Label>
              <Input
                id="attendees"
                name="attendees"
                type="number"
                min="1"
                value={formData.attendees}
                onChange={handleInputChange}
                required={reservationType === "event"}
                className="bg-card"
                placeholder={language === "en" ? "Enter number of attendees" : "Ingresa número de asistentes"}
              />
            </div>
          </div>

          {/* Additional Event Details */}
          <div className="space-y-2">
            <Label htmlFor="eventDescription">{language === "en" ? "Additional Details" : "Detalles Adicionales"}</Label>
            <Textarea
              id="eventDescription"
              name="eventDescription"
              value={formData.eventDescription}
              onChange={handleInputChange}
              className="min-h-[120px] resize-y bg-card"
              placeholder={language === "en" ? "Describe your event requirements..." : "Describe los requisitos de tu evento..."}
            />
          </div>
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full btn-hover"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {language === "en" ? "Processing..." : "Procesando..."}
          </>
        ) : (
          translations.contact.submitButton
        )}
      </Button>
    </form>
  );
}
