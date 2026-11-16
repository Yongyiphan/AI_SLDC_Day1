import { Component, OnInit, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { Link, LinksApiService } from './links-api.service';

function httpUrlValidator(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname
      ? null
      : { httpUrl: true };
  } catch {
    return { httpUrl: true };
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  private readonly api = inject(LinksApiService);

  readonly form = new FormGroup({
    url: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, httpUrlValidator],
    }),
  });
  readonly links = signal<Link[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly submitError = signal<string | null>(null);
  readonly createdLink = signal<Link | null>(null);

  get urlControl(): FormControl<string> {
    return this.form.controls.url;
  }

  ngOnInit(): void {
    this.refreshLinks();
  }

  createLink(): void {
    if (this.saving()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.submitError.set(null);
    this.createdLink.set(null);
    this.api.createLink(this.urlControl.value.trim())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (link) => {
          this.createdLink.set(link);
          this.form.reset();
          this.refreshLinks();
        },
        error: (error: unknown) => {
          this.submitError.set(this.getErrorMessage(error));
        },
      });
  }

  refreshLinks(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.listLinks()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (links) => this.links.set(links),
        error: () => this.loadError.set('Could not load links. Check that the Snip backend is running.'),
      });
  }

  private getErrorMessage(error: unknown): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof error.error === 'object' &&
      error.error !== null &&
      'error' in error.error &&
      typeof error.error.error === 'string'
    ) {
      return error.error.error;
    }
    return 'Could not create the link. Check that the Snip backend is running and try again.';
  }
}
