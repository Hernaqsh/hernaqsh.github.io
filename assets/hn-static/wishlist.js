/**
 * HerNaqsh – istek listesi (inc/wishlist.php).
 *
 * Sunucu HTML'i herkese aynı: kalpler boş, header sayacı gizli basılır;
 * durum burada yüklenir.
 * Ziyaretçi: localStorage, sunucuya istek yok. Giriş yapmış ("hn_wl_auth"
 * ipucu çerezi varsa): admin-ajax (no-store) + user meta; tarayıcıda kalan
 * liste girişten sonra hesaba eklenir ve tarayıcıdan silinir.
 * Wishlist sayfasında kalbe basınca kart akıcı biçimde listeden çıkar.
 */
( function () {
	'use strict';

	var cfg = window.hnWishlist;
	var KEY = 'hn_wishlist';
	var HINT = 'hn_wl_auth';
	var listBox = document.querySelector( '[data-hn-wishlist]' );
	if ( ! cfg || ( ! listBox && ! document.querySelector( '[data-hn-wish], [data-hn-wish-count]' ) ) ) {
		return;
	}

	var reduceMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' );
	var ids = [];
	var loggedIn = false;
	var nonce = '';
	var toastTimer;

	function readLocal() {
		try {
			var v = JSON.parse( localStorage.getItem( KEY ) || '[]' );
			return Array.isArray( v ) ? v.map( Number ).filter( Boolean ) : [];
		} catch ( e ) {
			return [];
		}
	}

	function writeLocal( list ) {
		try {
			if ( list.length ) {
				localStorage.setItem( KEY, JSON.stringify( list ) );
			} else {
				localStorage.removeItem( KEY );
			}
		} catch ( e ) {}
	}

	function hasHint() {
		return document.cookie.split( '; ' ).indexOf( HINT + '=1' ) > -1;
	}

	function clearHint() {
		document.cookie = HINT + '=; path=/; max-age=0; samesite=lax';
	}

	function ajax( action, params, method ) {
		// Static copy: no server. The list is built in the browser from products.json.
		if ( 'hernaqsh_wishlist_items' === action && window.hnStatic ) {
			return window.hnStatic.wishlistItems( ( params && params.ids ) || '' );
		}
		return Promise.reject( new Error( 'static' ) );
	}
	function ajaxServerUnused( action, params, method ) {
		var body = new URLSearchParams( params || {} );
		body.set( 'action', action );
		var url = cfg.ajax + ( 'GET' === method ? '?' + body.toString() : '' );
		return fetch( url, {
			method: method || 'GET',
			credentials: 'same-origin',
			cache: 'no-store',
			headers: 'POST' === method ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {},
			body: 'POST' === method ? body.toString() : undefined
		} ).then( function ( r ) {
			return r.json();
		} ).then( function ( r ) {
			if ( ! r || ! r.success ) {
				throw new Error( 'wishlist' );
			}
			return r.data;
		} );
	}

	// Hızlı art arda tıklamada eski bir yanıt yeni durumu ezmesin: yalnızca son kaydın yanıtı uygulanır.
	var saveSeq = 0;
	function Stale() {}

	function save() {
		if ( loggedIn ) {
			var seq = ++saveSeq;
			return ajax( 'hernaqsh_wishlist_save', { nonce: nonce, ids: ids.join( ',' ) }, 'POST' ).then( function ( d ) {
				if ( seq !== saveSeq ) {
					throw new Stale();
				}
				ids = d.ids;
			}, function ( err ) {
				throw seq === saveSeq ? err : new Stale();
			} );
		}
		writeLocal( ids );
		return Promise.resolve();
	}

	function paintCount() {
		var n = ids.length;
		document.querySelectorAll( '[data-hn-wish-count]' ).forEach( function ( el ) {
			el.textContent = n > 99 ? '99+' : String( n );
			el.hidden = ! n;
		} );
		document.querySelectorAll( '[data-hn-wish-nav]' ).forEach( function ( a ) {
			a.setAttribute( 'aria-label', n ? a.getAttribute( 'data-label-n' ).replace( '%d', n ) : a.getAttribute( 'data-label' ) );
		} );
	}

	function paint() {
		document.querySelectorAll( '[data-hn-wish]' ).forEach( function ( btn ) {
			var on = ids.indexOf( Number( btn.getAttribute( 'data-hn-wish' ) ) ) > -1;
			btn.setAttribute( 'aria-pressed', on ? 'true' : 'false' );
			var text = btn.querySelector( '.hn-wish__text' );
			if ( text ) {
				text.textContent = on ? cfg.labelOn : cfg.label;
			}
		} );
		paintCount();
	}

	function toast( message, link ) {
		var el = document.getElementById( 'hn-wish-toast' );
		if ( ! el ) {
			el = document.createElement( 'div' );
			el.id = 'hn-wish-toast';
			el.className = 'hn-wish-toast';
			el.setAttribute( 'role', 'status' );
			document.body.appendChild( el );
		}
		el.textContent = message + ' ';
		if ( link && cfg.page && ! listBox ) {
			var a = document.createElement( 'a' );
			a.href = cfg.page;
			a.textContent = cfg.view;
			el.appendChild( a );
		}
		el.classList.add( 'is-visible' );
		clearTimeout( toastTimer );
		toastTimer = setTimeout( function () {
			el.classList.remove( 'is-visible' );
		}, 3500 );
	}

	function showEmpty() {
		var tpl = document.getElementById( 'hn-wishlist-empty' );
		listBox.innerHTML = tpl ? tpl.innerHTML : '';
	}

	function renderList() {
		var params = loggedIn ? {} : { ids: ids.join( ',' ) };
		return ajax( 'hernaqsh_wishlist_items', params, 'GET' ).then( function ( d ) {
			ids = d.ids;
			if ( ! loggedIn ) {
				writeLocal( ids );
			}
			if ( d.html ) {
				listBox.innerHTML = d.html;
			} else {
				showEmpty();
			}
			paint();
		} );
	}

	/*
	 * Kart çıkışı: kart solar ve küçülür, kalan kartlar yeni yerlerine kayar
	 * (FLIP: önce/sonra konum farkı transform ile kapatılır). Son kart
	 * çıkınca boş durum gösterilir.
	 */
	function removeCard( card ) {
		var list = card.parentNode;
		var done = function () {
			var siblings = Array.prototype.filter.call( list.children, function ( li ) {
				return li !== card;
			} );
			var before = siblings.map( function ( li ) {
				return li.getBoundingClientRect();
			} );
			card.remove();
			if ( ! ids.length ) {
				showEmpty();
				return;
			}
			if ( reduceMotion.matches ) {
				return;
			}
			siblings.forEach( function ( li, i ) {
				var after = li.getBoundingClientRect();
				var dx = before[ i ].left - after.left;
				var dy = before[ i ].top - after.top;
				if ( ! dx && ! dy ) {
					return;
				}
				li.animate(
					[ { transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' } ],
					{ duration: 320, easing: 'cubic-bezier(.22,.61,.36,1)' }
				);
			} );
		};
		if ( reduceMotion.matches || ! card.animate ) {
			done();
			return;
		}
		card.style.pointerEvents = 'none';
		card.animate(
			[ { opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.92)' } ],
			{ duration: 220, easing: 'ease-in', fill: 'forwards' }
		).onfinish = done;
	}

	document.addEventListener( 'click', function ( e ) {
		var btn = e.target.closest( '[data-hn-wish]' );
		if ( ! btn ) {
			return;
		}
		e.preventDefault();
		var id = Number( btn.getAttribute( 'data-hn-wish' ) );
		var at = ids.indexOf( id );
		var adding = at < 0;
		if ( adding && ids.length >= cfg.max ) {
			toast( cfg.full );
			return;
		}
		if ( adding ) {
			ids.unshift( id );
		} else {
			ids.splice( at, 1 );
		}
		paint();

		// Wishlist sayfasında kart hemen çıkar; kayıt başarısız olursa liste yeniden yüklenir.
		var card = listBox && ! adding ? btn.closest( 'li.product' ) : null;
		if ( card ) {
			removeCard( card );
		}

		toast( adding ? cfg.saved : cfg.removed, adding );
		save().then( function () {
			paint();
		} ).catch( function ( err ) {
			if ( err instanceof Stale ) {
				return; // Daha yeni bir kayıt yolda; sonucu o belirler.
			}
			// Kaydedilemedi: görünümü geri al.
			if ( adding ) {
				ids.splice( ids.indexOf( id ), 1 );
			} else {
				ids.splice( at, 0, id );
			}
			paint();
			if ( card ) {
				renderList();
			}
		} );
	} );

	// Ziyaretçi: istek yok, liste tarayıcıda. Giriş ipucu varsa hesaptaki liste sorulur.
	var ready;
	if ( hasHint() ) {
		ids = readLocal();
		paintCount();
		ready = ajax( 'hernaqsh_wishlist', {}, 'GET' ).then( function ( d ) {
			loggedIn = d.loggedIn;
			nonce = d.nonce;
			var local = readLocal();
			if ( ! loggedIn ) {
				// Oturum bitmiş: ipucunu sil, tarayıcı listesine dön.
				clearHint();
				ids = local;
				return;
			}
			ids = d.ids;
			var merged = ids.concat( local.filter( function ( id ) {
				return ids.indexOf( id ) < 0;
			} ) ).slice( 0, cfg.max );
			if ( merged.length !== ids.length ) {
				ids = merged;
				return save().then( function () {
					writeLocal( [] );
				}, function ( err ) {
					if ( ! ( err instanceof Stale ) ) {
						throw err;
					}
				} );
			}
			writeLocal( [] );
		} ).catch( function () {
			ids = readLocal();
		} );
	} else {
		ids = readLocal();
		ready = Promise.resolve();
	}

	ready.then( function () {
		paint();
		if ( listBox ) {
			if ( ! loggedIn && ! ids.length ) {
				showEmpty();
				return;
			}
			return renderList();
		}
	} );
}() );
