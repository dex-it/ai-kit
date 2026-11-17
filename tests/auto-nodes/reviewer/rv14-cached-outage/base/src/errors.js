export class RefRejectedError extends Error {
  constructor(reason) {
    super(`reference rejected: ${reason}`)
    this.reason = reason
  }
}
