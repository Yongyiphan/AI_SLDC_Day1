import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Link {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class LinksApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = '/api/links';

  listLinks(): Observable<Link[]> {
    return this.http.get<Link[]>(this.endpoint);
  }

  createLink(url: string): Observable<Link> {
    return this.http.post<Link>(this.endpoint, { url });
  }
}
