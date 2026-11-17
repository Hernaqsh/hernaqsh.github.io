/**
 * HerNaqsh static demo: cart, checkout, shop filters and contact links
 * that run entirely in the browser. Nothing is sent to any server; the
 * cart lives in localStorage and no order is ever saved.
 */
( function () {
	'use strict';

	var CFG = window.HN_CONFIG || {};
	var CART_KEY = 'hn_static_cart';
	var WISH_KEY = 'hn_wishlist';
	var productsP = null;

	/* ---------- helpers ---------- */
	function products() {
		if ( ! productsP ) {
			productsP = fetch( '/assets/hn-static/products.json' ).then( function ( r ) {
				return r.json();
			} );
		}
		return productsP;
	}
	function byId( list ) {
		var m = {};
		list.forEach( function ( p ) {
			m[ p.id ] = p;
		} );
		return m;
	}
	function esc( s ) {
		return String( s == null ? '' : s ).replace( /[&<>"']/g, function ( c ) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ c ];
		} );
	}
	function money( n ) {
		return '<span class="woocommerce-Price-amount amount"><bdi><span class="woocommerce-Price-currencySymbol">' +
			esc( CFG.currencySymbol || '₨' ) + '</span>&nbsp;' + Number( n ).toLocaleString( 'en-US' ) + '</bdi></span>';
	}
	function isPlaceholder( v ) {
		return ! v || /X{2,}/i.test( String( v ) );
	}
	function waUrl( text ) {
		var n = String( CFG.whatsappNumber || '' ).replace( /\D/g, '' );
		if ( isPlaceholder( CFG.whatsappNumber ) || n.length < 8 ) {
			return '';
		}
		return 'https://wa.me/' + n + ( text ? '?text=' + encodeURIComponent( text ) : '' );
	}
	function readJSON( key, fallback ) {
		try {
			var v = JSON.parse( localStorage.getItem( key ) || 'null' );
			return v == null ? fallback : v;
		} catch ( e ) {
			return fallback;
		}
	}
	function writeJSON( key, v ) {
		try {
			localStorage.setItem( key, JSON.stringify( v ) );
		} catch ( e ) {}
	}

	/* ---------- cart store ---------- */
	function readCart() {
		var c = readJSON( CART_KEY, [] );
		return Array.isArray( c ) ? c.filter( function ( l ) {
			return l && l.id && l.qty > 0;
		} ) : [];
	}
	function writeCart( c ) {
		writeJSON( CART_KEY, c );
		paintHeader();
	}
	function cartCount() {
		return readCart().reduce( function ( n, l ) {
			return n + l.qty;
		}, 0 );
	}
	function addToCart( id, qty ) {
		var c = readCart();
		var line = c.filter( function ( l ) {
			return l.id === id;
		} )[ 0 ];
		if ( line ) {
			line.qty = Math.min( 99, line.qty + qty );
		} else {
			c.push( { id: id, qty: Math.min( 99, qty ) } );
		}
		writeCart( c );
	}
	function setQty( id, qty ) {
		writeCart( readCart().map( function ( l ) {
			if ( l.id === id ) {
				l.qty = Math.max( 0, Math.min( 99, qty ) );
			}
			return l;
		} ).filter( function ( l ) {
			return l.qty > 0;
		} ) );
	}

	/* ---------- header cart + mini cart ---------- */
	function paintHeader() {
		var n = cartCount();
		document.querySelectorAll( '.ast-site-header-cart .astra-icon[data-cart-total]' ).forEach( function ( i ) {
			i.setAttribute( 'data-cart-total', n );
		} );
		document.querySelectorAll( '.ast-site-header-cart .cart-container' ).forEach( function ( a ) {
			a.setAttribute( 'aria-label', n ? 'View Shopping Cart, ' + n + ( 1 === n ? ' item' : ' items' ) : 'View Shopping Cart, empty' );
		} );
		var boxes = document.querySelectorAll( '.widget_shopping_cart_content' );
		if ( ! boxes.length ) {
			return;
		}
		products().then( function ( d ) {
			var map = byId( d.products );
			var lines = readCart().filter( function ( l ) {
				return map[ l.id ];
			} );
			var html;
			if ( ! lines.length ) {
				html = '<p class="woocommerce-mini-cart__empty-message">No products in the cart.</p>';
			} else {
				var total = 0;
				html = '<ul class="woocommerce-mini-cart cart_list product_list_widget">' + lines.map( function ( l ) {
					var p = map[ l.id ];
					total += p.price * l.qty;
					return '<li class="woocommerce-mini-cart-item mini_cart_item"><a href="' + esc( p.url ) + '"><img width="70" src="' + esc( p.image ) + '" alt="">' + esc( p.name ) + '</a>' +
						'<span class="quantity">' + l.qty + ' &times; ' + money( p.price ) + '</span></li>';
				} ).join( '' ) + '</ul>' +
					'<p class="woocommerce-mini-cart__total total"><strong>Subtotal:</strong> ' + money( total ) + '</p>' +
					'<p class="woocommerce-mini-cart__buttons buttons"><a href="/cart/" class="button wc-forward">View cart</a><a href="/checkout/" class="button checkout wc-forward">Checkout</a></p>';
			}
			boxes.forEach( function ( b ) {
				b.innerHTML = html;
			} );
		} );
	}

	function bump() {
		document.querySelectorAll( '.ast-site-header-cart' ).forEach( function ( c ) {
			c.classList.remove( 'hn-bump' );
			void c.offsetWidth;
			c.classList.add( 'hn-bump' );
		} );
	}

	function notice( html ) {
		var w = document.querySelector( '.woocommerce-notices-wrapper' );
		if ( ! w ) {
			return;
		}
		w.innerHTML = '<div class="woocommerce-message" role="alert">' + html + '</div>';
	}

	/* ---------- add to cart: product cards ---------- */
	document.addEventListener( 'click', function ( e ) {
		var btn = e.target.closest( '.ajax_add_to_cart[data-product_id]' );
		if ( ! btn ) {
			return;
		}
		e.preventDefault();
		var id = Number( btn.getAttribute( 'data-product_id' ) );
		var qty = parseInt( btn.getAttribute( 'data-quantity' ), 10 ) || 1;
		addToCart( id, qty );
		var $ = window.jQuery;
		if ( $ ) {
			// ui.js shows "Adding… / Added" on the button.
			setTimeout( function () {
				$( document.body ).trigger( 'added_to_cart', [ {}, '', $( btn ) ] );
				paintHeader();
			}, 250 );
		}
		if ( btn.parentNode && ! btn.parentNode.querySelector( '.added_to_cart' ) && btn.classList.contains( 'button' ) ) {
			btn.insertAdjacentHTML( 'afterend', ' <a href="/cart/" class="added_to_cart wc-forward" title="View cart">View cart</a>' );
		}
	} );

	/* ---------- add to cart: single product form ---------- */
	document.addEventListener( 'submit', function ( e ) {
		var form = e.target.closest( 'form[data-hn-static-cart]' );
		if ( ! form ) {
			return;
		}
		e.preventDefault();
		e.stopPropagation();
		var btn = form.querySelector( '[name="add-to-cart"]' );
		var input = form.querySelector( 'input.qty' );
		var id = Number( btn && btn.value );
		var qty = Math.max( 1, parseInt( input && input.value, 10 ) || 1 );
		if ( ! id ) {
			return;
		}
		addToCart( id, qty );
		bump();
		var ui = window.hnUi || { added: 'Added' };
		if ( ! btn.hasAttribute( 'data-hn-label' ) ) {
			btn.setAttribute( 'data-hn-label', btn.textContent.trim() );
		}
		btn.textContent = ui.added;
		btn.classList.add( 'hn-added' );
		clearTimeout( btn.hnT );
		btn.hnT = setTimeout( function () {
			btn.textContent = btn.getAttribute( 'data-hn-label' );
			btn.classList.remove( 'hn-added' );
		}, 2500 );
		var title = document.querySelector( '.product_title' );
		notice( '<a href="/cart/" class="button wc-forward">View cart</a> ' + ( qty > 1 ? qty + ' &times; ' : '' ) + '&ldquo;' + esc( title ? title.textContent.trim() : 'Product' ) + '&rdquo; has been added to your cart.' );
	}, true );

	/* ---------- wishlist (used by the patched wishlist.js) ---------- */
	function wishIds() {
		var v = readJSON( WISH_KEY, [] );
		return Array.isArray( v ) ? v.map( Number ).filter( Boolean ) : [];
	}
	function paintHearts() {
		var ids = wishIds();
		document.querySelectorAll( '[data-hn-wish]' ).forEach( function ( b ) {
			b.setAttribute( 'aria-pressed', ids.indexOf( Number( b.getAttribute( 'data-hn-wish' ) ) ) > -1 ? 'true' : 'false' );
		} );
	}
	function cardsHtml( list ) {
		return '<div class="woocommerce columns-4"><ul class="products columns-4">' + list.map( function ( p ) {
			return p.card;
		} ).join( '' ) + '</ul></div>';
	}

	/* ---------- shop: search, filters, sorting ---------- */
	function sortList( list, orderby ) {
		var l = list.slice();
		if ( 'price' === orderby ) {
			l.sort( function ( a, b ) {
				return a.price - b.price;
			} );
		} else if ( 'price-desc' === orderby ) {
			l.sort( function ( a, b ) {
				return b.price - a.price;
			} );
		} else if ( 'date' === orderby ) {
			l.sort( function ( a, b ) {
				return b.id - a.id;
			} );
		} else {
			// menu_order, popularity, rating: the static copy has no sales/rating data.
			l.sort( function ( a, b ) {
				return a.order - b.order;
			} );
		}
		return l;
	}

	function filterList( list, f ) {
		var q = ( f.s || '' ).trim().toLowerCase();
		var min = '' === f.min_price || null == f.min_price ? null : Number( f.min_price );
		var max = '' === f.max_price || null == f.max_price ? null : Number( f.max_price );
		return list.filter( function ( p ) {
			if ( q && ( p.name + ' ' + p.catName + ' ' + p.seller.name + ' ' + p.sku ).toLowerCase().indexOf( q ) < 0 ) {
				return false;
			}
			if ( f.product_cat && p.cats.indexOf( f.product_cat ) < 0 ) {
				return false;
			}
			if ( f.seller && p.seller.slug !== f.seller ) {
				return false;
			}
			if ( null !== min && p.price < min ) {
				return false;
			}
			if ( null !== max && p.price > max ) {
				return false;
			}
			return true;
		} );
	}

	function initShop() {
		var form = document.querySelector( 'form.hn-filters' );
		var ul = document.querySelector( '.ast-woocommerce-container ul.products, main ul.products' );
		if ( ! form ) {
			return;
		}
		var onShop = /^\/shop\/?$/.test( location.pathname );
		var catSel = form.querySelector( '#hn-f-cat' );
		var pageCat = onShop ? '' : ( catSel ? catSel.value : '' );
		var ordering = document.querySelector( 'form.woocommerce-ordering' );

		function current() {
			var sp = new URLSearchParams( location.search );
			return {
				s: sp.get( 's' ) || '',
				product_cat: sp.has( 'product_cat' ) ? sp.get( 'product_cat' ) : pageCat,
				seller: sp.get( 'seller' ) || '',
				min_price: sp.get( 'min_price' ) || '',
				max_price: sp.get( 'max_price' ) || '',
				orderby: sp.get( 'orderby' ) || ''
			};
		}

		function fill( f ) {
			var set = function ( sel, v ) {
				var el = form.querySelector( sel );
				if ( el ) {
					el.value = v;
				}
			};
			set( '#hn-f-s', f.s );
			set( '#hn-f-cat', f.product_cat );
			set( '#hn-f-seller', f.seller );
			set( '#hn-f-min', f.min_price );
			set( '#hn-f-max', f.max_price );
			if ( ordering ) {
				ordering.querySelector( 'select' ).value = f.orderby || 'menu_order';
			}
			var active = f.s || f.seller || f.min_price || f.max_price || ( onShop && f.product_cat );
			var clear = form.querySelector( '.hn-filters__clear' );
			if ( active && ! clear ) {
				form.querySelector( '.hn-filters__actions' ).insertAdjacentHTML( 'beforeend', '<a class="hn-filters__clear" href="/shop/">Clear filters</a>' );
			} else if ( ! active && clear && onShop ) {
				clear.remove();
			}
		}

		function render( f ) {
			products().then( function ( d ) {
				var list = sortList( filterList( d.products, f ), f.orderby );
				var count = document.querySelector( '.woocommerce-result-count' );
				var info = document.querySelector( '.hn-static-noresults' );
				if ( info ) {
					info.remove();
				}
				if ( ul ) {
					ul.innerHTML = list.map( function ( p ) {
						return p.card;
					} ).join( '' );
					ul.hidden = ! list.length;
				}
				if ( ! list.length ) {
					( ul || form ).insertAdjacentHTML( 'afterend', '<p class="woocommerce-info hn-static-noresults">No products were found matching your selection.</p>' );
				}
				if ( count ) {
					count.textContent = 1 === list.length ? 'Showing the single result' : 'Showing all ' + list.length + ' results';
				}
				paintHearts();
			} );
		}

		function go( f ) {
			var sp = new URLSearchParams();
			Object.keys( f ).forEach( function ( k ) {
				if ( f[ k ] && ! ( 'orderby' === k && 'menu_order' === f[ k ] ) ) {
					sp.set( k, f[ k ] );
				}
			} );
			var qs = sp.toString();
			if ( ! onShop ) {
				location.href = '/shop/' + ( qs ? '?' + qs : '' );
				return;
			}
			history.replaceState( null, '', '/shop/' + ( qs ? '?' + qs : '' ) );
			fill( f );
			render( f );
		}

		form.addEventListener( 'submit', function ( e ) {
			e.preventDefault();
			e.stopImmediatePropagation();
			var fd = new FormData( form );
			go( {
				s: fd.get( 's' ) || '',
				product_cat: fd.get( 'product_cat' ) || '',
				seller: fd.get( 'seller' ) || '',
				min_price: fd.get( 'min_price' ) || '',
				max_price: fd.get( 'max_price' ) || '',
				orderby: current().orderby
			} );
		}, true );

		if ( ordering ) {
			ordering.addEventListener( 'submit', function ( e ) {
				e.preventDefault();
			} );
			ordering.querySelector( 'select' ).addEventListener( 'change', function () {
				var f = current();
				f.orderby = this.value;
				if ( onShop ) {
					go( f );
				} else {
					// Category page: re-sort in place, keep the URL.
					fill( f );
					render( f );
				}
			} );
		}

		var f0 = current();
		if ( location.search ) {
			fill( f0 );
			render( f0 );
		}
	}

	/* ---------- store page: product name search + sort, in place ---------- */
	function initStoreFilter() {
		var form = document.querySelector( 'form[data-hn-local-filter]' );
		if ( ! form ) {
			return;
		}
		var ul = document.querySelector( '#dokan-content ul.products, .dokan-single-store ul.products' );
		var input = form.querySelector( '[name="product_name"]' );
		var select = form.querySelector( 'select' );
		function apply() {
			if ( ! ul ) {
				return;
			}
			products().then( function ( d ) {
				var map = byId( d.products );
				var q = ( input && input.value || '' ).trim().toLowerCase();
				var items = Array.prototype.slice.call( ul.children );
				items.forEach( function ( li ) {
					var b = li.querySelector( '[data-hn-wish]' );
					var p = b && map[ Number( b.getAttribute( 'data-hn-wish' ) ) ];
					li.hidden = !! q && !! p && p.name.toLowerCase().indexOf( q ) < 0;
				} );
				var ordered = sortList( items.map( function ( li ) {
					var b = li.querySelector( '[data-hn-wish]' );
					var p = b && map[ Number( b.getAttribute( 'data-hn-wish' ) ) ];
					return { li: li, id: p ? p.id : 0, price: p ? p.price : 0, order: p ? p.order : 0 };
				} ), select ? select.value : '' );
				ordered.forEach( function ( o ) {
					ul.appendChild( o.li );
				} );
			} );
		}
		form.addEventListener( 'submit', function ( e ) {
			e.preventDefault();
			apply();
		} );
		if ( select ) {
			select.addEventListener( 'change', apply );
		}
		if ( input ) {
			input.addEventListener( 'input', apply );
		}
	}

	/* ---------- contact links + config text ---------- */
	function fillConfig() {
		document.querySelectorAll( '[data-hn-cfg]' ).forEach( function ( el ) {
			var v = CFG[ el.getAttribute( 'data-hn-cfg' ) ];
			if ( v ) {
				el.textContent = v;
			}
		} );
		document.querySelectorAll( '[data-hn-wa-link]' ).forEach( function ( a ) {
			var store = document.querySelector( '.store-name' );
			var text = store ? 'Hi HerNaqsh, I have a question for the shop ' + store.firstChild.textContent.trim() + '.' : 'Hi HerNaqsh, I have a question.';
			var url = waUrl( text );
			if ( url ) {
				a.href = url;
			} else {
				a.removeAttribute( 'href' );
				a.setAttribute( 'aria-disabled', 'true' );
				a.classList.add( 'is-placeholder' );
			}
		} );
		document.querySelectorAll( '[data-hn-mail-link]' ).forEach( function ( a ) {
			if ( isPlaceholder( CFG.email ) ) {
				a.removeAttribute( 'href' );
				a.classList.add( 'is-placeholder' );
			} else {
				a.href = 'mailto:' + CFG.email;
			}
		} );
		// Floating WhatsApp button, like the live theme: only once a real number is set.
		var path = location.pathname;
		if ( waUrl() && ! /^\/(cart|checkout|demo)\//.test( path ) && ! document.querySelector( '.hn-wa' ) ) {
			var title = document.querySelector( '.single-product .product_title' );
			var text = title ? 'Hi HerNaqsh, I have a question about ' + title.textContent.trim() + ': ' + location.href : 'Hi HerNaqsh, I have a question.';
			document.body.insertAdjacentHTML( 'beforeend', '<a class="hn-wa" href="' + esc( waUrl( text ) ) + '" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp (opens in a new tab)">' +
				'<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false"><path d="M12 2.2A9.7 9.7 0 0 0 3.6 16.8L2.3 21.7l5-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1 4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2 2.1 2.1 0 0 0 .2-1.2c-.1-.1-.2-.2-.5-.3z"/></svg>' +
				'<span class="hn-wa__text">Chat with us</span></a>' );
		}
	}

	/* ---------- cart page ---------- */
	function initCart() {
		var root = document.getElementById( 'hn-cart' );
		if ( ! root ) {
			return;
		}
		function draw() {
			products().then( function ( d ) {
				var map = byId( d.products );
				var lines = readCart().filter( function ( l ) {
					return map[ l.id ];
				} );
				if ( ! lines.length ) {
					root.innerHTML = '<div class="hn-static-empty"><p class="cart-empty woocommerce-info">Your cart is currently empty.</p>' +
						'<p class="return-to-shop"><a class="button wc-backward" href="/shop/">Return to shop</a></p></div>';
					return;
				}
				var sub = 0;
				var rows = lines.map( function ( l ) {
					var p = map[ l.id ];
					var line = p.price * l.qty;
					sub += line;
					return '<tr class="woocommerce-cart-form__cart-item cart_item" data-id="' + p.id + '">' +
						'<td class="product-remove"><button type="button" class="remove" data-hn-remove aria-label="Remove ' + esc( p.name ) + ' from cart">&times;</button></td>' +
						'<td class="product-thumbnail"><a href="' + esc( p.url ) + '"><img width="80" height="80" src="' + esc( p.image ) + '" alt=""></a></td>' +
						'<td class="product-name" data-title="Product"><a href="' + esc( p.url ) + '">' + esc( p.name ) + '</a>' +
						( p.seller.name ? '<span class="hn-static-seller">Sold by <a href="/store/' + esc( p.seller.slug ) + '/">' + esc( p.seller.name ) + '</a></span>' : '' ) + '</td>' +
						'<td class="product-price" data-title="Price">' + money( p.price ) + '</td>' +
						'<td class="product-quantity" data-title="Quantity"><div class="hn-static-qty">' +
						'<button type="button" data-hn-step="-1" aria-label="Decrease quantity">&minus;</button>' +
						'<label class="screen-reader-text" for="hn-q-' + p.id + '">Quantity of ' + esc( p.name ) + '</label>' +
						'<input type="number" class="input-text qty text" id="hn-q-' + p.id + '" min="0" max="99" step="1" inputmode="numeric" value="' + l.qty + '">' +
						'<button type="button" data-hn-step="1" aria-label="Increase quantity">+</button></div></td>' +
						'<td class="product-subtotal" data-title="Subtotal">' + money( line ) + '</td></tr>';
				} ).join( '' );
				var ship = Number( CFG.shippingFee ) || 0;
				root.innerHTML =
					'<p class="hn-static-banner">Demo shop: your cart is kept only in this browser. No order is placed and nothing is sent.</p>' +
					'<table class="shop_table shop_table_responsive cart woocommerce-cart-form__contents"><thead><tr>' +
					'<th class="product-remove"><span class="screen-reader-text">Remove item</span></th><th class="product-thumbnail"><span class="screen-reader-text">Thumbnail</span></th>' +
					'<th class="product-name">Product</th><th class="product-price">Price</th><th class="product-quantity">Quantity</th><th class="product-subtotal">Subtotal</th></tr></thead>' +
					'<tbody>' + rows + '</tbody></table>' +
					'<div class="cart-collaterals"><div class="cart_totals"><h2>Cart totals</h2><table class="shop_table shop_table_responsive"><tbody>' +
					'<tr class="cart-subtotal"><th>Subtotal</th><td data-title="Subtotal">' + money( sub ) + '</td></tr>' +
					'<tr class="shipping"><th>Shipping</th><td data-title="Shipping">' + ( ship ? money( ship ) : esc( CFG.shippingNote || 'Confirmed later' ) ) + '</td></tr>' +
					'<tr class="order-total"><th>Total</th><td data-title="Total"><strong>' + money( sub + ship ) + '</strong></td></tr></tbody></table>' +
					'<div class="wc-proceed-to-checkout"><a href="/checkout/" class="checkout-button button alt wc-forward">Proceed to checkout</a></div></div></div>';
			} );
		}
		root.addEventListener( 'click', function ( e ) {
			var tr = e.target.closest( 'tr[data-id]' );
			if ( ! tr ) {
				return;
			}
			var id = Number( tr.getAttribute( 'data-id' ) );
			if ( e.target.closest( '[data-hn-remove]' ) ) {
				setQty( id, 0 );
				draw();
			}
			var step = e.target.closest( '[data-hn-step]' );
			if ( step ) {
				var input = tr.querySelector( 'input.qty' );
				setQty( id, ( parseInt( input.value, 10 ) || 0 ) + Number( step.getAttribute( 'data-hn-step' ) ) );
				draw();
			}
		} );
		root.addEventListener( 'change', function ( e ) {
			var tr = e.target.closest( 'tr[data-id]' );
			if ( tr && e.target.matches( 'input.qty' ) ) {
				setQty( Number( tr.getAttribute( 'data-id' ) ), parseInt( e.target.value, 10 ) || 0 );
				draw();
			}
		} );
		draw();
	}

	/* ---------- checkout page ---------- */
	function paymentDetails( orderNo, total ) {
		var b = CFG.bank || {};
		var ep = CFG.easypaisa || {};
		var jc = CFG.jazzcash || {};
		var wa = waUrl( 'Hi HerNaqsh, payment screenshot for order ' + orderNo + ' (' + ( CFG.currencySymbol || '₨' ) + ' ' + total.toLocaleString( 'en-US' ) + ').' );
		var waText = esc( CFG.whatsappDisplay || 'XXXX' );
		return '<dl class="hn-static-pay">' +
			'<dt>Bank transfer</dt><dd>' + esc( b.bankName ) + '<br>Account title: ' + esc( b.accountTitle ) + '<br>Account no.: ' + esc( b.accountNumber ) + '<br>IBAN: ' + esc( b.iban ) + '</dd>' +
			'<dt>Easypaisa</dt><dd>' + esc( ep.number ) + ' &middot; ' + esc( ep.accountTitle ) + '</dd>' +
			'<dt>JazzCash</dt><dd>' + esc( jc.number ) + ' &middot; ' + esc( jc.accountTitle ) + '</dd></dl>' +
			'<p class="hn-static-pay__how">Transfer the amount and share the screenshot with your order number on WhatsApp: ' +
			( wa ? '<a href="' + esc( wa ) + '" target="_blank" rel="noopener"><strong>' + waText + '</strong></a>' : '<strong>' + waText + '</strong>' ) + '</p>' +
			'<p class="hn-static-note">Example details for this demo. Do not send money.</p>';
	}

	function initCheckout() {
		var root = document.getElementById( 'hn-checkout' );
		if ( ! root ) {
			return;
		}
		products().then( function ( d ) {
			var map = byId( d.products );
			var lines = readCart().filter( function ( l ) {
				return map[ l.id ] && map[ l.id ].inStock;
			} );
			if ( ! lines.length ) {
				root.innerHTML = '<p class="cart-empty woocommerce-info">Your cart is empty, so there is nothing to check out.</p>' +
					'<p class="return-to-shop"><a class="button wc-backward" href="/shop/">Return to shop</a></p>';
				return;
			}
			var sub = 0;
			var rows = lines.map( function ( l ) {
				var p = map[ l.id ];
				sub += p.price * l.qty;
				return '<tr class="cart_item"><td class="product-name">' + esc( p.name ) + ' <strong class="product-quantity">&times;&nbsp;' + l.qty + '</strong>' +
					( p.seller.name ? '<span class="hn-static-seller">Sold by ' + esc( p.seller.name ) + '</span>' : '' ) + '</td>' +
					'<td class="product-total">' + money( p.price * l.qty ) + '</td></tr>';
			} ).join( '' );
			var ship = Number( CFG.shippingFee ) || 0;
			var total = sub + ship;
			var summary = '<table class="shop_table woocommerce-checkout-review-order-table"><thead><tr><th class="product-name">Product</th><th class="product-total">Subtotal</th></tr></thead>' +
				'<tbody>' + rows + '</tbody><tfoot>' +
				'<tr class="cart-subtotal"><th>Subtotal</th><td>' + money( sub ) + '</td></tr>' +
				'<tr class="woocommerce-shipping-totals shipping"><th>Shipping</th><td>' + ( ship ? money( ship ) : esc( CFG.shippingNote || 'Confirmed later' ) ) + '</td></tr>' +
				'<tr class="order-total"><th>Total</th><td><strong>' + money( total ) + '</strong></td></tr></tfoot></table>';
			var field = function ( id, label, type, req, ac, full ) {
				return '<p class="form-row ' + ( full ? 'form-row-wide' : 'form-row-first' ) + ( req ? ' validate-required' : '' ) + '"><label for="' + id + '">' + label +
					( req ? '&nbsp;<abbr class="required" title="required">*</abbr>' : '&nbsp;<span class="optional">(optional)</span>' ) + '</label>' +
					'<span class="woocommerce-input-wrapper"><input class="input-text" type="' + type + '" id="' + id + '" name="' + id + '" autocomplete="' + ac + '"' + ( req ? ' required' : '' ) + '></span></p>';
			};
			root.innerHTML =
				'<p class="hn-static-banner">Demo checkout: nothing you type here is saved or sent. The order is only shown on screen.</p>' +
				'<form class="checkout woocommerce-checkout hn-static-checkout" novalidate>' +
				'<div class="col2-set" id="customer_details"><div class="col-1"><div class="woocommerce-billing-fields"><h3>Billing &amp; delivery details</h3>' +
				'<div class="woocommerce-billing-fields__field-wrapper">' +
				field( 'billing_first_name', 'First name', 'text', true, 'given-name' ) +
				field( 'billing_last_name', 'Last name', 'text', true, 'family-name' ).replace( 'form-row-first', 'form-row-last' ) +
				field( 'billing_phone', 'Phone', 'tel', true, 'tel', true ) +
				field( 'billing_city', 'Town / City', 'text', true, 'address-level2', true ) +
				field( 'billing_address_1', 'Street address', 'text', true, 'address-line1', true ) +
				field( 'billing_email', 'Email address', 'email', false, 'email', true ) +
				'</div></div></div></div>' +
				'<h3 id="order_review_heading">Your order</h3><div id="order_review" class="woocommerce-checkout-review-order">' + summary +
				'<div id="payment" class="woocommerce-checkout-payment"><ul class="wc_payment_methods payment_methods methods">' +
				'<li class="wc_payment_method payment_method_cod"><input id="payment_method_cod" type="radio" class="input-radio" name="payment_method" value="cod" checked>' +
				'<label for="payment_method_cod">Cash on delivery</label><div class="payment_box payment_method_cod"><p>Pay with cash when your order is delivered.</p></div></li>' +
				'<li class="wc_payment_method payment_method_online"><input id="payment_method_online" type="radio" class="input-radio" name="payment_method" value="online">' +
				'<label for="payment_method_online">Online payment (bank transfer / Easypaisa / JazzCash)</label>' +
				'<div class="payment_box payment_method_online" hidden>' + paymentDetails( 'your order number', total ) + '</div></li></ul>' +
				'<div class="form-row place-order"><button type="submit" class="button alt" id="place_order">Show order summary (demo)</button></div></div></div></form>';

			var form = root.querySelector( 'form' );
			function syncBoxes() {
				root.querySelectorAll( '.payment_box' ).forEach( function ( box ) {
					var input = box.parentNode.querySelector( 'input[name="payment_method"]' );
					box.hidden = ! input.checked;
				} );
			}
			form.addEventListener( 'change', syncBoxes );
			syncBoxes();
			form.addEventListener( 'submit', function ( e ) {
				e.preventDefault();
				var missing = Array.prototype.filter.call( form.querySelectorAll( '[required]' ), function ( i ) {
					return ! i.value.trim();
				} );
				form.querySelectorAll( '.woocommerce-invalid' ).forEach( function ( r ) {
					r.classList.remove( 'woocommerce-invalid' );
				} );
				if ( missing.length ) {
					missing.forEach( function ( i ) {
						i.closest( '.form-row' ).classList.add( 'woocommerce-invalid' );
					} );
					missing[ 0 ].focus();
					return;
				}
				var method = form.querySelector( 'input[name="payment_method"]:checked' ).value;
				var orderNo = ( CFG.orderPrefix || 'HN-DEMO-' ) + String( Date.now() ).slice( -6 );
				var name = form.billing_first_name.value.trim();
				root.innerHTML =
					'<div class="woocommerce-order hn-static-done">' +
					'<p class="woocommerce-notice woocommerce-notice--success woocommerce-thankyou-order-received">Thank you, ' + esc( name ) + '. This is a demo, so your order was <strong>not</strong> placed and nothing was sent or saved.</p>' +
					'<ul class="woocommerce-order-overview order_details">' +
					'<li class="order">Demo order number: <strong>' + esc( orderNo ) + '</strong></li>' +
					'<li class="total">Total: <strong>' + money( total ) + '</strong></li>' +
					'<li class="method">Payment method: <strong>' + ( 'online' === method ? 'Online payment (bank transfer / Easypaisa / JazzCash)' : 'Cash on delivery' ) + '</strong></li></ul>' +
					( 'online' === method ? '<h2>Payment instructions</h2>' + paymentDetails( orderNo, total ) : '<p>Cash on delivery: you would pay the rider when the parcel arrives.</p>' ) +
					'<h2>Order summary</h2>' + summary +
					'<p><a class="button" href="/shop/">Continue shopping</a> <button type="button" class="button hn-static-clear">Empty the demo cart</button></p></div>';
				root.querySelector( '.hn-static-clear' ).addEventListener( 'click', function () {
					writeCart( [] );
					location.href = '/shop/';
				} );
				window.scrollTo( { top: root.getBoundingClientRect().top + window.scrollY - 120 } );
			} );
		} );
	}

	window.hnStatic = {
		products: products,
		wishlistItems: function ( idsStr ) {
			return products().then( function ( d ) {
				var map = byId( d.products );
				var ids = String( idsStr ).split( ',' ).map( Number ).filter( function ( id ) {
					return map[ id ];
				} );
				return { ids: ids, html: ids.length ? cardsHtml( ids.map( function ( id ) {
					return map[ id ];
				} ) ) : '' };
			} );
		}
	};

	function init() {
		paintHeader();
		fillConfig();
		initShop();
		initStoreFilter();
		initCart();
		initCheckout();
	}
	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
	// Another tab changed the cart.
	window.addEventListener( 'storage', function ( e ) {
		if ( CART_KEY === e.key ) {
			paintHeader();
		}
	} );
}() );
