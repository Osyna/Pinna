const canVibrate = typeof navigator !== 'undefined' && !!navigator.vibrate

/** Light tap feedback */
export function hapticTap() {
  if (canVibrate) navigator.vibrate(8)
}

/** Medium feedback for confirmations */
export function hapticSuccess() {
  if (canVibrate) navigator.vibrate([10, 30, 10])
}

/** Heavy feedback for warnings */
export function hapticWarning() {
  if (canVibrate) navigator.vibrate([20, 40, 20])
}

/** Selection change feedback */
export function hapticSelect() {
  if (canVibrate) navigator.vibrate(4)
}
