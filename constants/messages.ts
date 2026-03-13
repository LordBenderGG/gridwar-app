export const BLOCK_MESSAGES_ES = [
  'Perdiste... otra vez. Qué sorpresa. Vuelve en {tiempo}.',
  'El tablero te venció. Descansa tu orgullo herido por {tiempo}.',
  'No te preocupes, hasta los campeones pierden... aunque tú no eres un campeón. Espera {tiempo}.',
  'Bloqueado. Tus 3 neuronas necesitan recuperarse. {tiempo} restantes.',
  'El tablero no es para todos. Claramente tampoco es para ti. Vuelve en {tiempo}.',
  'Derrotado, humillado y bloqueado. Un combo perfecto. {tiempo} para reflexionar.',
  'Hasta la IA básica te ganaría. Descansa {tiempo} e intenta de nuevo.',
];

export const BLOCK_MESSAGES_EN = [
  'You lost. Again. Shocking. Come back in {tiempo}.',
  'The board defeated you. Rest your wounded pride for {tiempo}.',
  "Don't worry, even champions lose... though you're not a champion. Wait {tiempo}.",
  'Blocked. Your 3 brain cells need recovery time. {tiempo} left.',
  "The board isn't for everyone. Clearly not for you either. Back in {tiempo}.",
  'Defeated, humiliated, and blocked. A perfect combo. {tiempo} to reflect.',
  'Even basic AI would beat you. Rest {tiempo} and try again.',
];

export const REJECT_MESSAGES_ES = [
  '¿Cobarde? Rechazaste el reto. Eso te costó puntos y 30 minutos de bloqueo.',
  'Huiste del reto como un gallina. -50 puntos y 30 minutos castigado.',
  'No aceptar tiene consecuencias. Bloqueado 30 minutos y -50 puntos.',
];

export const REJECT_MESSAGES_EN = [
  'Coward? You rejected the challenge. That cost you points and 30 minutes blocked.',
  'You ran from the challenge like a chicken. -50 points and 30 minutes punished.',
  "Not accepting has consequences. Blocked 30 minutes and -50 points.",
];

export const VICTORY_MESSAGES_ES = [
  '¡VICTORIA APLASTANTE!',
  '¡ERES IMPARABLE!',
  '¡EL TABLERO ES TUYO!',
  '¡NADIE TE DETIENE!',
];

export const DEFEAT_MESSAGES_ES = [
  '¡DERROTA HUMILLANTE!',
  '¡EL TABLERO TE VENCIÓ!',
  '¡QUÉ VERGÜENZA!',
  '¡HASTA EL PRÓXIMO FRACASO!',
];

export const getRandomMessage = (messages: string[], tiempo?: string): string => {
  const msg = messages[Math.floor(Math.random() * messages.length)];
  return tiempo ? msg.replace('{tiempo}', tiempo) : msg;
};

export const formatCountdown = (ms: number): string => {
  if (ms <= 0) return '00:00:00';
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};
