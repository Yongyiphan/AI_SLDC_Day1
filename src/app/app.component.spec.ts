import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  function createFixture() {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    httpTesting.expectOne('http://localhost:3000/api/links').flush([]);
    fixture.detectChanges();
    return fixture;
  }

  it('validates HTTP and HTTPS URLs before sending a request', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    component.urlControl.setValue('javascript:alert(1)');
    component.createLink();

    expect(component.urlControl.hasError('httpUrl')).toBeTrue();
    httpTesting.expectNone('http://localhost:3000/api/links');
  });

  it('creates a link and refreshes the links table', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;
    const link = {
      code: 'a1B2c3',
      url: 'https://example.com/',
      shortUrl: 'http://localhost:3000/a1B2c3',
      hits: 0,
      createdAt: '2026-01-01T00:00:00.000Z',
    };

    component.urlControl.setValue(link.url);
    component.createLink();
    httpTesting.expectOne('http://localhost:3000/api/links').flush(link);
    httpTesting.expectOne('http://localhost:3000/api/links').flush([link]);
    fixture.detectChanges();

    expect(component.createdLink()).toEqual(link);
    expect(component.links()).toEqual([link]);
    expect(fixture.nativeElement.textContent).toContain(link.shortUrl);
  });

  it('shows API errors inline', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance;

    component.urlControl.setValue('https://example.com');
    component.createLink();
    httpTesting.expectOne('http://localhost:3000/api/links').flush(
      { error: 'url must be a valid HTTP or HTTPS URL' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(component.submitError()).toBe('url must be a valid HTTP or HTTPS URL');
    expect(fixture.nativeElement.textContent).toContain('url must be a valid HTTP or HTTPS URL');
  });
});
