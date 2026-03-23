import { Injectable } from '@nestjs/common'
import { readFileSync } from 'fs'
import { join } from 'path'

@Injectable()
export class PdfService {
  private templates: Record<string, string> = {}

  private getTemplate(type: string): string {
    const key = type.toLowerCase()
    if (!this.templates[key]) {
      // Try dist path first, fall back to src path for dev
      let path: string
      try {
        path = join(__dirname, 'templates', `${key}.html`)
        this.templates[key] = readFileSync(path, 'utf-8')
      } catch {
        path = join(process.cwd(), 'src', 'modules', 'contracts', 'templates', `${key}.html`)
        this.templates[key] = readFileSync(path, 'utf-8')
      }
    }
    return this.templates[key]
  }

  generateHtml(templateType: string, fields: Record<string, string>): string {
    let html = this.getTemplate(templateType)

    // Replace all {{field}} markers with provided values
    for (const [key, value] of Object.entries(fields)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value ?? '')
    }

    // Legacy: replace generatedDate if not already in fields
    html = html.replace(/\{\{generatedDate\}\}/g, new Date().toLocaleDateString('pt-BR'))

    // Replace any remaining unreplaced {{field}} markers with empty string
    html = html.replace(/\{\{[^}]+\}\}/g, '')

    return html
  }
}
