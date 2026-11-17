/**
 * HerNaqsh – arayüz etkileşimleri (harici kütüphane yok).
 *
 * 1. Yapışkan header: kaydırınca body'ye "hn-scrolled" sınıfı.
 * 2. Kaydırınca belirme: IntersectionObserver + kademeli gecikme.
 * 3. Sepete ekle: anında "Adding…" + sayaç artışı, bitince "Added";
 *    ürün sayfasında sayfa yenilemeden AJAX ile ekleme.
 * 4. Hesabım: mobil sekme şeridinde aktif sekmeyi görünür alana kaydır.
 *
 * JS çalışmazsa içerik normal görünür: gizleme sınıfı ("hn-reveal")
 * yalnızca burada eklenir.
 */
( function () {
	'use strict';

	var doc = document.documentElement;
	var body = document.body;
	var reduceMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' );

	doc.classList.add( 'hn-js' );

	/* ---------- 1. Header ---------- */
	var ticking = false;
	var scrolled = false;

	function updateHeader() {
		var next = window.scrollY > 24;
		if ( next !== scrolled ) {
			scrolled = next;
			body.classList.toggle( 'hn-scrolled', scrolled );
		}
		ticking = false;
	}

	window.addEventListener( 'scroll', function () {
		if ( ! ticking ) {
			ticking = true;
			window.requestAnimationFrame( updateHeader );
		}
	}, { passive: true } );
	updateHeader();

	/* ---------- 2. Kaydırınca belirme ---------- */
	var REVEAL_SELECTOR = [
		'.entry-content > .wp-block-heading',
		'.entry-content > .wp-block-columns > .wp-block-column',
		'ul.products > li.product',
		'.related.products > h2',
		'.woocommerce-tabs',
		'.woocommerce-MyAccount-navigation',
		'.woocommerce-MyAccount-content'
	].join( ',' );

	var STAGGER = 60; // ms, aynı anda görünen öğeler arası
	var MAX_STAGGER = 4;

	function initReveal() {
		if ( reduceMotion.matches || ! ( 'IntersectionObserver' in window ) ) {
			return;
		}

		var items = document.querySelectorAll( REVEAL_SELECTOR );
		if ( ! items.length ) {
			return;
		}

		var observer = new IntersectionObserver( function ( entries ) {
			var batch = 0;
			entries.forEach( function ( entry ) {
				if ( ! entry.isIntersecting ) {
					return;
				}
				var el = entry.target;
				el.style.transitionDelay = Math.min( batch, MAX_STAGGER ) * STAGGER + 'ms';
				el.classList.add( 'is-visible' );
				batch++;
				observer.unobserve( el );
				// Gecikme hover geçişlerini yavaşlatmasın.
				el.addEventListener( 'transitionend', function clear() {
					el.style.transitionDelay = '';
					el.classList.remove( 'hn-reveal' );
					el.removeEventListener( 'transitionend', clear );
				} );
			} );
		}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 } );

		// Zaten ekranda olanlar gizlenmesin: ilk boyamadan sonra gizleyip
		// yeniden göstermek yanıp sönme yaratıyordu.
		var viewportH = window.innerHeight;
		items.forEach( function ( el ) {
			var rect = el.getBoundingClientRect();
			if ( rect.top < viewportH && rect.bottom > 0 ) {
				return;
			}
			el.classList.add( 'hn-reveal' );
			observer.observe( el );
		} );

		// Yazdırırken kaydırılmamış bölümler gizli kalmasın.
		window.addEventListener( 'beforeprint', function () {
			items.forEach( function ( el ) {
				el.classList.add( 'is-visible' );
			} );
		} );
	}

	/* ---------- 3. Sepete ekle geri bildirimi ----------
	 * Tıklama anında: buton "Adding…" + dönen simge, header sayacı hemen
	 * artar ve zıplar. İstek bitince "Added"; hata olursa sayaç ve buton
	 * geri alınır. Sunucudan gelen fragment sayacın gerçek değerini yazar.
	 * Ürün sayfasındaki form (basit ürün) da sayfa yenilemeden AJAX ile
	 * eklenir; hata olursa form normal gönderilir ve WooCommerce uyarısı
	 * görünür.
	 */
	var $ = window.jQuery;
	var atc = window.hnUi || { adding: 'Adding…', added: 'Added' };
	var ADDED_MS = 2500;
	var SAFETY_MS = 20000;
	var pending = [];

	function bumpCart() {
		if ( reduceMotion.matches ) {
			return;
		}
		document.querySelectorAll( '.ast-site-header-cart' ).forEach( function ( cart ) {
			cart.classList.remove( 'hn-bump' );
			void cart.offsetWidth; // animasyonu yeniden başlat
			cart.classList.add( 'hn-bump' );
		} );
	}

	// Header'daki sepet sayaçları (masaüstü + mobil); Astra sayıyı data-cart-total'dan basar.
	function shiftCartCount( delta ) {
		document.querySelectorAll( '.ast-site-header-cart .astra-icon[data-cart-total]' ).forEach( function ( icon ) {
			var n = parseInt( icon.getAttribute( 'data-cart-total' ), 10 ) || 0;
			icon.setAttribute( 'data-cart-total', Math.max( 0, n + delta ) );
		} );
	}

	// Butonun yazısı: kart altındaki buton metni ya da görsel üstündeki ikonun ipucu.
	function labelOf( btn ) {
		return btn.querySelector( '.ast-card-action-tooltip' ) || btn;
	}

	function setLabel( btn, state ) {
		var label = labelOf( btn );
		if ( ! btn.hasAttribute( 'data-hn-label' ) ) {
			btn.setAttribute( 'data-hn-label', label.textContent.trim() );
		}
		var text = 'idle' === state ? btn.getAttribute( 'data-hn-label' ) : atc[ state ];
		if ( label === btn ) {
			btn.innerHTML = '';
			if ( 'idle' !== state ) {
				var icon = document.createElement( 'span' );
				icon.className = 'hn-atc-icon';
				icon.setAttribute( 'aria-hidden', 'true' );
				btn.appendChild( icon );
			}
			btn.appendChild( document.createTextNode( text ) );
		} else {
			label.textContent = text;
		}
		btn.classList.toggle( 'hn-adding', 'adding' === state );
		btn.classList.toggle( 'hn-added', 'added' === state );
		if ( 'adding' === state ) {
			btn.setAttribute( 'aria-busy', 'true' );
		} else {
			btn.removeAttribute( 'aria-busy' );
		}
	}

	function startAdding( btn, qty ) {
		clearTimeout( btn.hnTimer );
		setLabel( btn, 'adding' );
		shiftCartCount( qty );
		bumpCart();
		var job = { btn: btn, qty: qty };
		job.safety = setTimeout( function () {
			failAdding( job );
		}, SAFETY_MS );
		pending.push( job );
		return job;
	}

	function settle( job ) {
		clearTimeout( job.safety );
		var at = pending.indexOf( job );
		if ( at > -1 ) {
			pending.splice( at, 1 );
		}
	}

	function finishAdding( job ) {
		settle( job );
		var btn = job.btn;
		btn.classList.remove( 'loading' );
		setLabel( btn, 'added' );
		btn.hnTimer = setTimeout( function () {
			setLabel( btn, 'idle' );
		}, ADDED_MS );
	}

	function failAdding( job ) {
		settle( job );
		job.btn.classList.remove( 'loading' );
		shiftCartCount( -job.qty );
		setLabel( job.btn, 'idle' );
	}

	function jobFor( btn ) {
		for ( var i = 0; i < pending.length; i++ ) {
			if ( pending[ i ].btn === btn ) {
				return pending[ i ];
			}
		}
		return null;
	}

	// Kart butonları: WooCommerce'in kendi AJAX'ı çalışır, biz yalnızca anında durumu gösteririz.
	// Yakalama aşaması: WooCommerce'in jQuery dinleyicisinden önce çalışır.
	document.addEventListener( 'click', function ( e ) {
		var btn = e.target.closest( '.ajax_add_to_cart[data-product_id]' );
		if ( ! btn || ! $ || jobFor( btn ) || btn.classList.contains( 'loading' ) ) {
			return;
		}
		startAdding( btn, parseInt( btn.getAttribute( 'data-quantity' ), 10 ) || 1 );
	}, true );

	if ( $ ) {
		$( document.body ).on( 'added_to_cart', function ( e, fragments, hash, $button ) {
			var btn = $button && $button[ 0 ];
			var job = btn ? jobFor( btn ) : pending[ 0 ];
			if ( job ) {
				finishAdding( job );
			}
		} );

		// WooCommerce isteği göndermediyse (başka bir eklenti durdurduysa) geri al.
		$( document.body ).on( 'ajax_request_not_sent.adding_to_cart', function ( e, $button ) {
			var job = $button && jobFor( $button[ 0 ] );
			if ( job ) {
				failAdding( job );
			}
		} );
	}

	// Ürün sayfası formu: yalnızca basit ürün; diğer türler normal gönderilir.
	function initSingleAjax() {
		var form = document.querySelector( '.product-type-simple form.cart:not(.grouped_form)' );
		var params = window.wc_add_to_cart_params;
		if ( ! form || ! $ || ! params || 'yes' === params.cart_redirect_after_add ) {
			return;
		}
		form.addEventListener( 'submit', function ( e ) {
			var btn = form.querySelector( 'button.single_add_to_cart_button[value]' );
			if ( form.hnNativeSubmit || ! btn || btn.disabled || jobFor( btn ) ) {
				return;
			}
			e.preventDefault();

			var data = new URLSearchParams( new FormData( form ) );
			// "add-to-cart" alanı kalırsa WooCommerce'in form işleyicisi de çalışır ve ürün iki kez eklenir.
			data.delete( 'add-to-cart' );
			data.set( 'product_id', btn.value );
			var qty = parseInt( data.get( 'quantity' ), 10 ) || 1;
			var job = startAdding( btn, qty );

			$.ajax( {
				type: 'POST',
				url: params.wc_ajax_url.toString().replace( '%%endpoint%%', 'add_to_cart' ),
				data: data.toString(),
				dataType: 'json'
			} ).done( function ( res ) {
				if ( ! res || res.error ) {
					// Stok / doğrulama hatası: formu normal gönder, WooCommerce uyarısı görünsün.
					failAdding( job );
					form.hnNativeSubmit = true;
					btn.click();
					return;
				}
				$( document.body ).trigger( 'added_to_cart', [ res.fragments, res.cart_hash, $( btn ) ] );
			} ).fail( function () {
				failAdding( job );
			} );
		} );
	}

	// Ürün sayfası formu normal gönderildiyse "Sepeti görüntüle" bildirimi
	// varsa rozet yüklemede bir kez zıplasın.
	function bumpAfterReload() {
		if ( document.querySelector( '.woocommerce-notices-wrapper .woocommerce-message .wc-forward' ) ) {
			window.requestAnimationFrame( bumpCart );
		}
	}

	/* ---------- 4. Hesabım: mobil sekme şeridinde aktif sekme görünsün ---------- */
	function showActiveAccountTab() {
		var list = document.querySelector( '.woocommerce-MyAccount-navigation ul' );
		var active = list && list.querySelector( 'li.is-active' );
		if ( ! active || list.scrollWidth <= list.clientWidth ) {
			return;
		}
		list.scrollLeft += active.getBoundingClientRect().left - list.getBoundingClientRect().left - 8;
	}

	function init() {
		initReveal();
		initSingleAjax();
		bumpAfterReload();
		showActiveAccountTab();
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
}() );
