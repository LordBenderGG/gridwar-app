import { useThemeStore } from '../store/themeStore';
import { DARK_COLORS, LIGHT_COLORS, ThemeColors } from '../constants/theme';

/**
 * Devuelve los colores del tema activo (oscuro o claro).
 * Usar dentro de cualquier componente/pantalla en lugar de importar COLORS directamente.
 *
 * Ejemplo:
 *   const COLORS = useColors();
 *   const styles = useMemo(() => createStyles(COLORS), [COLORS]);
 */
export const useColors = (): ThemeColors => {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? DARK_COLORS : LIGHT_COLORS;
};
