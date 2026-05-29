<cfcomponent>
  <cffunction name="getCustomer" access="public" returntype="query">
    <cfargument name="custId" type="numeric" required="true">

    <cfquery name="qCustomer" datasource="globe3">
      SELECT cust_id, cust_name, email
      FROM customers
      WHERE cust_id = #arguments.custId#
    </cfquery>

    <cfreturn qCustomer>
  </cffunction>

  <cffunction name="listActive" access="public" returntype="query">
    <cfquery name="qList" datasource="globe3">
      SELECT cust_id, cust_name
      FROM customers
      WHERE status = 'A'
    </cfquery>
    <cfreturn qList>
  </cffunction>
</cfcomponent>
